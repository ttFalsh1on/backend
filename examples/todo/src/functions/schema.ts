import { query, v } from "@flex/core";
import { resolveProjectScope } from "../lib/access.js";
import { parseFieldsJson } from "../lib/fieldTypes.js";
import { tableFnPath } from "../lib/dynamicEngine.js";

/** Один запрос вместо tables:list + projectFns:list — быстрее на Vercel */
export const load = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { projectId }) => {
    const { projectId: pid } = await resolveProjectScope(
      ctx,
      projectId ? String(projectId) : null
    );

    const [tableRows, fnRows] = await Promise.all([
      ctx.db
        .query("projectTables")
        .withIndex("by_project", (q) => q.eq("projectId", pid))
        .collect(),
      ctx.db
        .query("projectFunctions")
        .withIndex("by_project", (q) => q.eq("projectId", pid))
        .collect(),
    ]);

    return {
      tables: tableRows.map((row) => ({
        _id: row._id,
        name: row.name,
        fields: parseFieldsJson(row.fieldsJson as string),
        listPath: tableFnPath(row.name as string, "list"),
        createPath: tableFnPath(row.name as string, "create"),
        removePath: tableFnPath(row.name as string, "remove"),
      })),
      functions: fnRows.map((row) => ({
        _id: row._id,
        name: row.name,
        kind: row.kind,
        args: parseFieldsJson(row.argsJson as string),
        tableId: row.tableId ?? null,
        operation: row.operation ?? null,
      })),
    };
  },
});
