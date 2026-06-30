import type { FlexRuntime } from "@flex/core";
import type { ExecuteOptions, FunctionContext } from "@flex/core";
import { resolveAuth } from "./resolveAuth.js";
import { assertProjectMember, slugify } from "./access.js";
import {
  parseFieldsJson,
  serializeFields,
  type FieldDef,
} from "./fieldTypes.js";
import { writeProjectLog } from "./projectLog.js";

const OPS = ["list", "get", "create", "patch", "remove"] as const;
export type DynamicOp = (typeof OPS)[number];

export function tableFnPath(tableName: string, op: DynamicOp): string {
  return `${slugify(tableName)}:${op}`;
}

function coerceValue(type: FieldDef["type"], value: unknown): unknown {
  if (value === undefined || value === null) return value;
  switch (type) {
    case "string":
      return String(value);
    case "number": {
      const n = Number(value);
      if (Number.isNaN(n)) throw new Error("Ожидалось число");
      return n;
    }
    case "boolean":
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      throw new Error("Ожидалось true/false");
    case "id":
      return String(value);
    default:
      return value;
  }
}

function validateDoc(
  fields: FieldDef[],
  args: Record<string, unknown>,
  partial: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const val = args[f.name];
    if (val === undefined || val === null) {
      if (!partial) throw new Error(`Поле «${f.name}» обязательно`);
      continue;
    }
    out[f.name] = coerceValue(f.type, val);
  }
  return out;
}

function rowToDoc(row: Record<string, unknown>): Record<string, unknown> {
  const data = JSON.parse(row.dataJson as string) as Record<string, unknown>;
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    ...data,
  };
}

async function listRows(
  ctx: FunctionContext,
  tableId: string
): Promise<Record<string, unknown>[]> {
  const rows = await ctx.db
    .query("dynamicRows")
    .withIndex("by_table", (q) => q.eq("tableId", tableId))
    .collect();
  return rows.map((r) => rowToDoc(r as Record<string, unknown>));
}

async function getRow(
  ctx: FunctionContext,
  tableId: string,
  id: string
): Promise<Record<string, unknown>> {
  const rows = await ctx.db
    .query("dynamicRows")
    .withIndex("by_table", (q) => q.eq("tableId", tableId))
    .filter((r) => r._id === id)
    .collect();
  const row = rows[0];
  if (!row) throw new Error("Запись не найдена");
  return rowToDoc(row as Record<string, unknown>);
}

export async function deleteRowsForTable(
  ctx: FunctionContext,
  tableId: string
): Promise<void> {
  const rows = await ctx.db
    .query("dynamicRows")
    .withIndex("by_table", (q) => q.eq("tableId", tableId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete("dynamicRows", row._id as string);
  }
}

export async function deleteRowsForProject(
  ctx: FunctionContext,
  projectId: string
): Promise<void> {
  const rows = await ctx.db
    .query("dynamicRows")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete("dynamicRows", row._id as string);
  }
}

export async function deleteFunctionsForTable(
  ctx: FunctionContext,
  tableId: string
): Promise<void> {
  const rows = await ctx.db.query("projectFunctions").collect();
  for (const row of rows) {
    if (row.tableId === tableId) {
      await ctx.db.delete("projectFunctions", row._id as string);
    }
  }
}

export async function provisionTableFunctions(
  ctx: FunctionContext,
  projectId: string,
  tableId: string,
  tableName: string,
  fields: FieldDef[]
): Promise<string[]> {
  const paths: string[] = [];
  const specs: Array<{
    op: DynamicOp;
    kind: "query" | "mutation";
    args: FieldDef[];
  }> = [
    { op: "list", kind: "query", args: [] },
    { op: "get", kind: "query", args: [{ name: "id", type: "id" }] },
    { op: "create", kind: "mutation", args: fields },
    {
      op: "patch",
      kind: "mutation",
      args: [...fields, { name: "id", type: "id" }],
    },
    { op: "remove", kind: "mutation", args: [{ name: "id", type: "id" }] },
  ];

  for (const spec of specs) {
    const name = tableFnPath(tableName, spec.op);
    await ctx.db.insert("projectFunctions", {
      projectId,
      tableId,
      operation: spec.op,
      name,
      kind: spec.kind,
      argsJson: serializeFields(spec.args),
    });
    paths.push(name);
  }

  return paths;
}

function createReadonlyDb(db: ReturnType<FlexRuntime["getDatabase"]>) {
  return {
    get: (table: string, id: string) => db.get(table, id),
    query: (table: string) => db.query(table),
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
  } as FunctionContext["db"];
}

async function runOperation(
  ctx: FunctionContext,
  projectId: string,
  tableId: string,
  fields: FieldDef[],
  operation: DynamicOp,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (operation) {
    case "list":
      return listRows(ctx, tableId);
    case "get": {
      const id = String(args.id ?? "");
      if (!id) throw new Error("Укажите id");
      return getRow(ctx, tableId, id);
    }
    case "create": {
      const data = validateDoc(fields, args, false);
      const id = await ctx.db.insert("dynamicRows", {
        projectId,
        tableId,
        dataJson: JSON.stringify(data),
      });
      const doc = await getRow(ctx, tableId, id);
      await writeProjectLog(ctx, projectId, "info", "create", {
        tableId,
        id,
      });
      return doc;
    }
    case "patch": {
      const id = String(args.id ?? "");
      if (!id) throw new Error("Укажите id");
      const existing = await getRow(ctx, tableId, id);
      const patch = validateDoc(fields, args, true);
      const merged = { ...existing, ...patch, _id: id };
      const { _id: _i, _creationTime, ...rest } = merged;
      await ctx.db.patch("dynamicRows", id, {
        dataJson: JSON.stringify(rest),
      });
      const doc = await getRow(ctx, tableId, id);
      await writeProjectLog(ctx, projectId, "info", "patch", { tableId, id });
      return doc;
    }
    case "remove": {
      const id = String(args.id ?? "");
      if (!id) throw new Error("Укажите id");
      await getRow(ctx, tableId, id);
      await ctx.db.delete("dynamicRows", id);
      await writeProjectLog(ctx, projectId, "info", "remove", { tableId, id });
      return { ok: true, id };
    }
    default:
      throw new Error(`Неизвестная операция: ${operation}`);
  }
}

export async function executeDynamic(
  runtime: FlexRuntime,
  path: string,
  args: Record<string, unknown>,
  options: ExecuteOptions
): Promise<{ value: unknown; tablesWritten: string[] }> {
  const db = runtime.getDatabase();
  const auth = await resolveAuth(db, options);
  if (!auth?.userId) throw new Error("Требуется вход в аккаунт");

  const projectId = options.projectId?.trim() || auth.projectId;
  if (!projectId) throw new Error("Выберите проект (заголовок X-Project-Id)");

  const fnRows = await db
    .query("projectFunctions")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();

  const fnRow = fnRows.find((r) => r.name === path);
  if (!fnRow?.tableId || !fnRow.operation) {
    throw new Error(`Function not found: ${path}`);
  }

  const operation = fnRow.operation as DynamicOp;
  if (!OPS.includes(operation)) {
    throw new Error(`Неизвестная операция: ${operation}`);
  }

  const table = await db.get("projectTables", fnRow.tableId as string);
  if (!table) throw new Error("Таблица не найдена");

  const fields = parseFieldsJson(table.fieldsJson as string);
  const tableId = fnRow.tableId as string;
  const isMutation = fnRow.kind === "mutation";

  const ctx: FunctionContext = {
    db: isMutation ? db : createReadonlyDb(db),
    auth,
    scheduler: { runAfter: () => {} },
    runMutation: async (name, a) => {
      const r = await runtime.execute(name, a, options);
      return r.value;
    },
    runQuery: async (name, a) => {
      const r = await runtime.execute(name, a, options);
      return r.value;
    },
  };

  await assertProjectMember(ctx, projectId, auth.userId);

  if (isMutation) {
    const value = await db.transactionAsync(() =>
      runOperation(ctx, projectId, tableId, fields, operation, args)
    );
    return { value, tablesWritten: ["dynamicRows"] };
  }

  const value = await runOperation(
    ctx,
    projectId,
    tableId,
    fields,
    operation,
    args
  );
  return { value, tablesWritten: [] };
}
