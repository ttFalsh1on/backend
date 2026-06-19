import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import type {
  DatabaseReader,
  DocId,
  DocumentValue,
  IndexBound,
  IndexRange,
  IndexRangeBuilder,
  QueryBuilder,
  SchemaDefinition,
} from "./types.js";

function indexKey(values: unknown[]): string {
  return JSON.stringify(values);
}

function generateId(): DocId {
  return randomUUID().replace(/-/g, "");
}

class IndexRangeBuilderImpl implements IndexRangeBuilder {
  bounds: IndexBound[] = [];

  eq(field: string, value: unknown): IndexRange {
    this.bounds.push({ field, op: "eq", value });
    return { bounds: this.bounds };
  }

  gte(field: string, value: unknown): IndexRange {
    this.bounds.push({ field, op: "gte", value });
    return { bounds: this.bounds };
  }

  lte(field: string, value: unknown): IndexRange {
    this.bounds.push({ field, op: "lte", value });
    return { bounds: this.bounds };
  }
}

class QueryBuilderImpl implements QueryBuilder {
  private table: string;
  private db: FlexDatabase;
  private indexName?: string;
  private indexRange?: IndexRange;
  private filters: ((doc: DocumentValue) => boolean)[] = [];
  private orderDir: "asc" | "desc" = "asc";
  private limit?: number;

  constructor(table: string, db: FlexDatabase) {
    this.table = table;
    this.db = db;
  }

  withIndex(indexName: string, range: (q: IndexRangeBuilder) => IndexRange): QueryBuilder {
    const builder = new IndexRangeBuilderImpl();
    this.indexName = indexName;
    this.indexRange = range(builder);
    return this;
  }

  filter(predicate: (doc: DocumentValue) => boolean): QueryBuilder {
    this.filters.push(predicate);
    return this;
  }

  order(direction: "asc" | "desc"): QueryBuilder {
    this.orderDir = direction;
    return this;
  }

  take(n: number): QueryBuilder {
    this.limit = n;
    return this;
  }

  async first(): Promise<DocumentValue | null> {
    const docs = await this.collect();
    return docs[0] ?? null;
  }

  async collect(): Promise<DocumentValue[]> {
    let docs = this.db.loadDocs(this.table);

    if (this.indexName && this.indexRange) {
      docs = this.db.filterByIndex(
        this.table,
        this.indexName,
        this.indexRange.bounds,
        docs
      );
    }

    for (const f of this.filters) {
      docs = docs.filter(f);
    }

    docs.sort((a, b) => {
      const ta = (a._creationTime as number) ?? 0;
      const tb = (b._creationTime as number) ?? 0;
      return this.orderDir === "asc" ? ta - tb : tb - ta;
    });

    if (this.limit !== undefined) {
      docs = docs.slice(0, this.limit);
    }

    return docs;
  }
}

export class FlexDatabase implements DatabaseReader {
  private sqlite: DatabaseType.Database;
  private schema: SchemaDefinition;
  private writeTables = new Set<string>();

  constructor(dbPath: string, schema: SchemaDefinition) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const require = createRequire(import.meta.url);
    const BetterSqlite3 = require("better-sqlite3") as new (
      path: string
    ) => DatabaseType.Database;
    this.sqlite = new BetterSqlite3(dbPath);
    this.schema = schema;
    this.init();
  }

  private init(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS _documents (
        table_name TEXT NOT NULL,
        doc_id TEXT NOT NULL,
        data TEXT NOT NULL,
        creation_time INTEGER NOT NULL,
        PRIMARY KEY (table_name, doc_id)
      );
      CREATE TABLE IF NOT EXISTS _index (
        table_name TEXT NOT NULL,
        index_name TEXT NOT NULL,
        index_key TEXT NOT NULL,
        doc_id TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lookup
        ON _index (table_name, index_name, index_key);
    `);
  }

  getWrittenTables(): string[] {
    return [...this.writeTables];
  }

  clearWriteTracking(): void {
    this.writeTables.clear();
  }

  trackWrite(table: string): void {
    this.writeTables.add(table);
  }

  loadDocs(table: string): DocumentValue[] {
    const rows = this.sqlite
      .prepare(
        `SELECT data, creation_time FROM _documents WHERE table_name = ?`
      )
      .all(table) as { data: string; creation_time: number }[];

    return rows.map((r) => {
      const doc = JSON.parse(r.data) as DocumentValue;
      doc._id = doc._id as string;
      doc._creationTime = r.creation_time;
      return doc;
    });
  }

  filterByIndex(
    table: string,
    indexName: string,
    bounds: IndexBound[],
    fallbackDocs: DocumentValue[]
  ): DocumentValue[] {
    const tableDef = this.schema.tables[table];
    const indexDef = tableDef?.indexes.find((i) => i.name === indexName);
    if (!indexDef) {
      throw new Error(`Index "${indexName}" not found on table "${table}"`);
    }

    const eqBounds = bounds.filter((b) => b.op === "eq");
    if (eqBounds.length > 0) {
      const keyParts = indexDef.fields.map((field) => {
        const bound = eqBounds.find((b) => b.field === field);
        return bound?.value;
      });
      const key = indexKey(keyParts);
      const rows = this.sqlite
        .prepare(
          `SELECT doc_id FROM _index
           WHERE table_name = ? AND index_name = ? AND index_key = ?`
        )
        .all(table, indexName, key) as { doc_id: string }[];

      const ids = new Set(rows.map((r) => r.doc_id));
      return fallbackDocs.filter((d) => ids.has(d._id as string));
    }

    return fallbackDocs.filter((doc) =>
      bounds.every((b) => {
        const val = doc[b.field];
        if (b.op === "eq") return val === b.value;
        if (b.op === "gte") return (val as number) >= (b.value as number);
        if (b.op === "lte") return (val as number) <= (b.value as number);
        return true;
      })
    );
  }

  private updateIndexes(table: string, docId: string, doc: DocumentValue): void {
    const tableDef = this.schema.tables[table];
    if (!tableDef) return;

    this.sqlite
      .prepare(
        `DELETE FROM _index WHERE table_name = ? AND doc_id = ?`
      )
      .run(table, docId);

    for (const index of tableDef.indexes) {
      const keyParts = index.fields.map((f) => doc[f]);
      const key = indexKey(keyParts);
      this.sqlite
        .prepare(
          `INSERT INTO _index (table_name, index_name, index_key, doc_id)
           VALUES (?, ?, ?, ?)`
        )
        .run(table, index.name, key, docId);
    }
  }

  async get(table: string, id: DocId): Promise<DocumentValue | null> {
    const row = this.sqlite
      .prepare(
        `SELECT data, creation_time FROM _documents
         WHERE table_name = ? AND doc_id = ?`
      )
      .get(table, id) as { data: string; creation_time: number } | undefined;

    if (!row) return null;
    const doc = JSON.parse(row.data) as DocumentValue;
    doc._id = id;
    doc._creationTime = row.creation_time;
    return doc;
  }

  query(table: string): QueryBuilder {
    if (!this.schema.tables[table]) {
      throw new Error(`Unknown table "${table}"`);
    }
    return new QueryBuilderImpl(table, this);
  }

  async insert(table: string, doc: DocumentValue): Promise<DocId> {
    const id = generateId();
    const now = Date.now();
    const { _id: _ignored, _creationTime: _ct, ...rest } = doc;
    const stored = { ...rest, _id: id };
    const data = JSON.stringify(stored);

    this.sqlite
      .prepare(
        `INSERT INTO _documents (table_name, doc_id, data, creation_time)
         VALUES (?, ?, ?, ?)`
      )
      .run(table, id, data, now);

    const fullDoc = { ...stored, _creationTime: now };
    this.updateIndexes(table, id, fullDoc);
    this.trackWrite(table);
    return id;
  }

  async patch(
    table: string,
    id: DocId,
    fields: Partial<DocumentValue>
  ): Promise<void> {
    const existing = await this.get(table, id);
    if (!existing) {
      throw new Error(`Document ${id} not found in ${table}`);
    }
    const { _id, _creationTime, ...rest } = existing;
    const merged = { ...rest, ...fields, _id: id };
    const data = JSON.stringify(merged);

    this.sqlite
      .prepare(`UPDATE _documents SET data = ? WHERE table_name = ? AND doc_id = ?`)
      .run(data, table, id);

    const fullDoc = { ...merged, _creationTime };
    this.updateIndexes(table, id, fullDoc);
    this.trackWrite(table);
  }

  async replace(table: string, id: DocId, doc: DocumentValue): Promise<void> {
    const existing = await this.get(table, id);
    if (!existing) {
      throw new Error(`Document ${id} not found in ${table}`);
    }
    const { _creationTime } = existing;
    const { _id: _ignored, ...rest } = doc;
    const merged = { ...rest, _id: id };
    const data = JSON.stringify(merged);

    this.sqlite
      .prepare(`UPDATE _documents SET data = ? WHERE table_name = ? AND doc_id = ?`)
      .run(data, table, id);

    const fullDoc = { ...merged, _creationTime };
    this.updateIndexes(table, id, fullDoc);
    this.trackWrite(table);
  }

  async delete(table: string, id: DocId): Promise<void> {
    this.sqlite
      .prepare(`DELETE FROM _documents WHERE table_name = ? AND doc_id = ?`)
      .run(table, id);
    this.sqlite
      .prepare(`DELETE FROM _index WHERE table_name = ? AND doc_id = ?`)
      .run(table, id);
    this.trackWrite(table);
  }

  transaction<T>(fn: () => T): T {
    return this.sqlite.transaction(fn)();
  }

  async transactionAsync<T>(fn: () => Promise<T>): Promise<T> {
    this.sqlite.exec("BEGIN");
    try {
      const result = await fn();
      this.sqlite.exec("COMMIT");
      return result;
    } catch (err) {
      this.sqlite.exec("ROLLBACK");
      throw err;
    }
  }

  close(): void {
    this.sqlite.close();
  }
}

export function createDatabase(
  dbPath: string,
  schema: SchemaDefinition
): FlexDatabase {
  return new FlexDatabase(dbPath, schema);
}
