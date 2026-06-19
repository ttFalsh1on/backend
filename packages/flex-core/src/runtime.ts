import type { FlexDatabase } from "./db.js";
import type { JsonFlexDatabase } from "./json-db.js";

type RuntimeDb = FlexDatabase | JsonFlexDatabase;
import type {
  AuthContext,
  ExecuteOptions,
  FunctionContext,
  RegisteredFunction,
  SchemaDefinition,
} from "./types.js";
import { parseArgs } from "./validators.js";

export interface FlexBackendOptions {
  dbPath: string;
  schema: SchemaDefinition;
  auth?: (options: ExecuteOptions) => Promise<AuthContext | null>;
}

export interface FunctionModule {
  [exportName: string]: RegisteredFunction | unknown;
}

export class FlexRuntime {
  readonly schema: SchemaDefinition;
  private db: RuntimeDb;
  private functions = new Map<string, RegisteredFunction>();
  private authFn?: FlexBackendOptions["auth"];
  private scheduled: Array<{
    runAt: number;
    mutation: string;
    args: Record<string, unknown>;
  }> = [];

  constructor(db: RuntimeDb, options: Pick<FlexBackendOptions, "schema" | "auth">) {
    this.db = db;
    this.schema = options.schema;
    this.authFn = options.auth;
  }

  registerModule(modulePath: string, mod: FunctionModule): void {
    for (const [name, value] of Object.entries(mod)) {
      if (value && typeof value === "object" && "kind" in value && "handler" in value) {
        const fn = value as RegisteredFunction;
        const path = `${modulePath}:${name}`;
        fn.path = path;
        this.functions.set(path, fn);
      }
    }
  }

  listFunctions(): Array<{
    path: string;
    kind: string;
    args: string;
  }> {
    return [...this.functions.values()].map((f) => ({
      path: f.path,
      kind: f.kind,
      args: f.argsValidator._type,
    }));
  }

  getFunction(path: string): RegisteredFunction | undefined {
    return this.functions.get(path);
  }

  getDatabase(): RuntimeDb {
    return this.db;
  }

  async execute(
    path: string,
    args: Record<string, unknown>,
    options?: ExecuteOptions
  ): Promise<{ value: unknown; tablesWritten: string[] }> {
    const fn = this.functions.get(path);
    if (!fn) {
      throw new Error(`Function not found: ${path}`);
    }

    const parsedArgs = parseArgs(fn.argsValidator, args) as Record<string, unknown>;
    const auth = this.authFn
      ? await this.authFn({
          token: options?.token ?? null,
          projectId: options?.projectId ?? null,
        })
      : null;

    const ctx = this.createContext(auth, fn.kind === "mutation");

    if (fn.kind === "mutation") {
      const value = await this.db.transactionAsync(() =>
        fn.handler(ctx, parsedArgs)
      );
      const tablesWritten = this.db.getWrittenTables();
      this.db.clearWriteTracking();
      this.flushScheduled();
      return { value, tablesWritten };
    }

    if (fn.kind === "query") {
      const value = await fn.handler(ctx, parsedArgs);
      return { value, tablesWritten: [] };
    }

    // action — no transaction, can call external APIs
    const value = await fn.handler(ctx, parsedArgs);
    return { value, tablesWritten: this.db.getWrittenTables() };
  }

  private createContext(auth: AuthContext | null, writable: boolean): FunctionContext {
    const db = writable
      ? this.db
      : this.createReadonlyDb();

    const scheduler = {
      runAfter: (ms: number, mutation: string, args: Record<string, unknown>) => {
        this.scheduled.push({
          runAt: Date.now() + ms,
          mutation,
          args,
        });
      },
    };

    return {
      db,
      auth,
      scheduler,
      runMutation: async (name, args) => {
        const r = await this.execute(name, args);
        return r.value;
      },
      runQuery: async (name, args) => {
        const r = await this.execute(name, args);
        return r.value;
      },
    };
  }

  private createReadonlyDb(): FunctionContext["db"] {
    const self = this.db;
    const readOnly = {
      get: (table: string, id: string) => self.get(table, id),
      query: (table: string) => self.query(table),
      insert: () => {
        throw new Error("Cannot write in a query");
      },
      patch: () => {
        throw new Error("Cannot write in a query");
      },
      replace: () => {
        throw new Error("Cannot write in a query");
      },
      delete: () => {
        throw new Error("Cannot write in a query");
      },
    };
    return readOnly as FunctionContext["db"];
  }

  private flushScheduled(): void {
    const now = Date.now();
    const due = this.scheduled.filter((s) => s.runAt <= now);
    this.scheduled = this.scheduled.filter((s) => s.runAt > now);
    for (const job of due) {
      void this.execute(job.mutation, job.args);
    }
  }
}

export function createRuntime(
  db: FlexDatabase,
  options: Pick<FlexBackendOptions, "schema" | "auth">
): FlexRuntime {
  return new FlexRuntime(db, options);
}
