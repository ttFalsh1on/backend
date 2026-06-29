import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
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

type DocRow = { data: DocumentValue; creationTime: number };
type StoreData = Record<string, Record<string, DocRow>>;

export interface JsonDatabaseOptions {
  initialStore?: StoreData;
  onPersist?: (json: string) => void | Promise<void>;
}

/** JSON-файл вместо SQLite — для Vercel serverless */
export class JsonFlexDatabase implements DatabaseReader {
  private schema: SchemaDefinition;
  private filePath: string;
  private store: StoreData = {};
  private writeTables = new Set<string>();
  private onPersist?: JsonDatabaseOptions["onPersist"];
  private inTransaction = false;
  private dirty = false;

  constructor(
    filePath: string,
    schema: SchemaDefinition,
    options?: JsonDatabaseOptions
  ) {
    this.filePath = filePath;
    this.schema = schema;
    this.onPersist = options?.onPersist;
    mkdirSync(dirname(filePath), { recursive: true });
    if (options?.initialStore) {
      this.store = options.initialStore;
    } else if (existsSync(filePath)) {
      try {
        this.store = JSON.parse(readFileSync(filePath, "utf8")) as StoreData;
      } catch {
        this.store = {};
      }
    }
  }

  private async flushPersist(): Promise<void> {
    const json = JSON.stringify(this.store);
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, json, "utf8");
    renameSync(tmp, this.filePath);
    if (this.onPersist) {
      await this.onPersist(json);
    }
    this.dirty = false;
  }

  private persist(): void {
    if (this.inTransaction) {
      this.dirty = true;
      return;
    }
    void this.flushPersist();
  }

  getWrittenTables(): string[] {
    return [...this.writeTables];
  }
  clearWriteTracking(): void {
    this.writeTables.clear();
  }
  private trackWrite(table: string): void {
    this.writeTables.add(table);
  }

  loadDocs(table: string): DocumentValue[] {
    const tableData = this.store[table] ?? {};
    return Object.entries(tableData).map(([id, row]) => ({
      ...row.data,
      _id: id,
      _creationTime: row.creationTime,
    }));
  }

  filterByIndex(
    table: string,
    indexName: string,
    bounds: IndexBound[],
    fallbackDocs: DocumentValue[]
  ): DocumentValue[] {
    const indexDef = this.schema.tables[table]?.indexes.find(
      (i) => i.name === indexName
    );
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
      return fallbackDocs.filter((doc) => {
        const docKey = indexKey(indexDef.fields.map((f) => doc[f]));
        return docKey === key;
      });
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

  async get(table: string, id: DocId): Promise<DocumentValue | null> {
    const row = this.store[table]?.[id];
    if (!row) return null;
    return { ...row.data, _id: id, _creationTime: row.creationTime };
  }

  query(table: string): QueryBuilder {
    if (!this.schema.tables[table]) {
      throw new Error(`Unknown table "${table}"`);
    }
    const self = this;
    class QB implements QueryBuilder {
      private indexName?: string;
      private indexRange?: IndexRange;
      private filters: ((doc: DocumentValue) => boolean)[] = [];
      private orderDir: "asc" | "desc" = "asc";
      private limit?: number;
      withIndex(
        indexName: string,
        range: (q: IndexRangeBuilder) => IndexRange
      ): QueryBuilder {
        const b = new IndexRangeBuilderImpl();
        this.indexName = indexName;
        this.indexRange = range(b);
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
        let docs = self.loadDocs(table);
        if (this.indexName && this.indexRange) {
          docs = self.filterByIndex(
            table,
            this.indexName,
            this.indexRange.bounds,
            docs
          );
        }
        for (const f of this.filters) docs = docs.filter(f);
        docs.sort((a, b) => {
          const ta = (a._creationTime as number) ?? 0;
          const tb = (b._creationTime as number) ?? 0;
          return this.orderDir === "asc" ? ta - tb : tb - ta;
        });
        if (this.limit !== undefined) docs = docs.slice(0, this.limit);
        return docs;
      }
    }
    return new QB();
  }

  async insert(table: string, doc: DocumentValue): Promise<DocId> {
    const id = generateId();
    const now = Date.now();
    const { _id: _i, _creationTime: _c, ...rest } = doc;
    const stored = { ...rest, _id: id };
    if (!this.store[table]) this.store[table] = {};
    this.store[table][id] = { data: stored, creationTime: now };
    this.persist();
    this.trackWrite(table);
    return id;
  }

  async patch(
    table: string,
    id: DocId,
    fields: Partial<DocumentValue>
  ): Promise<void> {
    const existing = await this.get(table, id);
    if (!existing) throw new Error(`Document ${id} not found in ${table}`);
    const { _id, _creationTime, ...rest } = existing;
    const merged = { ...rest, ...fields, _id: id };
    this.store[table]![id] = {
      data: merged,
      creationTime: _creationTime as number,
    };
    this.persist();
    this.trackWrite(table);
  }

  async replace(table: string, id: DocId, doc: DocumentValue): Promise<void> {
    const existing = await this.get(table, id);
    if (!existing) throw new Error(`Document ${id} not found in ${table}`);
    const { _creationTime } = existing;
    const { _id: _i, ...rest } = doc;
    const merged = { ...rest, _id: id };
    this.store[table]![id] = { data: merged, creationTime: _creationTime as number };
    this.persist();
    this.trackWrite(table);
  }

  async delete(table: string, id: DocId): Promise<void> {
    if (this.store[table]) delete this.store[table][id];
    this.persist();
    this.trackWrite(table);
  }

  async transactionAsync<T>(fn: () => Promise<T>): Promise<T> {
    this.inTransaction = true;
    this.dirty = false;
    try {
      const result = await fn();
      if (this.dirty) {
        await this.flushPersist();
      }
      return result;
    } finally {
      this.inTransaction = false;
    }
  }

  close(): void {}
}

export function createJsonDatabase(
  filePath: string,
  schema: SchemaDefinition,
  options?: JsonDatabaseOptions
): JsonFlexDatabase {
  return new JsonFlexDatabase(filePath, schema, options);
}
