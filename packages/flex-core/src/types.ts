export type FunctionKind = "query" | "mutation" | "action";

export type DocumentValue = Record<string, unknown>;

export type DocId = string;

export interface TableDefinition {
  name: string;
  fields: Record<string, Validator>;
  indexes: IndexDefinition[];
}

export interface IndexDefinition {
  name: string;
  fields: string[];
}

export interface SchemaDefinition {
  tables: Record<string, TableDefinition>;
}

export interface RegisteredFunction {
  path: string;
  kind: FunctionKind;
  argsValidator: Validator;
  handler: FunctionHandler;
  tables?: string[];
}

export type FunctionHandler = (
  ctx: FunctionContext,
  args: Record<string, unknown>
) => Promise<unknown>;

export interface FunctionContext {
  db: DatabaseReader;
  auth: AuthContext | null;
  scheduler: Scheduler;
  runMutation: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  runQuery: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface AuthContext {
  userId: string;
  email?: string;
  name?: string;
  /** Активный проект (из заголовка X-Project-Id) */
  projectId?: string;
  token?: string;
  [key: string]: unknown;
}

export interface ExecuteOptions {
  token?: string | null;
  projectId?: string | null;
}

export interface Scheduler {
  runAfter: (ms: number, mutation: string, args: Record<string, unknown>) => void;
}

export interface DatabaseReader {
  get: (table: string, id: DocId) => Promise<DocumentValue | null>;
  query: (table: string) => QueryBuilder;
  insert: (table: string, doc: DocumentValue) => Promise<DocId>;
  patch: (table: string, id: DocId, fields: Partial<DocumentValue>) => Promise<void>;
  replace: (table: string, id: DocId, doc: DocumentValue) => Promise<void>;
  delete: (table: string, id: DocId) => Promise<void>;
}

export interface QueryBuilder {
  withIndex(
    indexName: string,
    range: (q: IndexRangeBuilder) => IndexRange
  ): QueryBuilder;
  filter(predicate: (doc: DocumentValue) => boolean): QueryBuilder;
  order(direction: "asc" | "desc"): QueryBuilder;
  take(n: number): QueryBuilder;
  first(): Promise<DocumentValue | null>;
  collect(): Promise<DocumentValue[]>;
}

export interface IndexRangeBuilder {
  eq(field: string, value: unknown): IndexRange;
  gte(field: string, value: unknown): IndexRange;
  lte(field: string, value: unknown): IndexRange;
}

export interface IndexRange {
  bounds: IndexBound[];
}

export interface IndexBound {
  field: string;
  op: "eq" | "gte" | "lte";
  value: unknown;
}

// Validator types - forward declare from validators.ts
export interface Validator {
  readonly _type: string;
  readonly _table?: string;
  parse(value: unknown): unknown;
  optional(): Validator;
}
