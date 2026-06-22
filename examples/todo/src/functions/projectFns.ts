import { mutation, query, v } from "@flex/core";
import { requireAuth, resolveProjectScope, assertProjectMember, slugify } from "../lib/access.js";
import {
  parseFieldsJson,
  serializeFields,
  validateFields,
  type FieldDef,
} from "../lib/fieldTypes.js";

const argValidator = v.object({
  name: v.string(),
  type: v.string(),
});

const FN_KINDS = ["query", "mutation"] as const;

export const list = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { projectId }) => {
    const { projectId: pid } = await resolveProjectScope(
      ctx,
      projectId ? String(projectId) : null
    );

    const rows = await ctx.db
      .query("projectFunctions")
      .withIndex("by_project", (q) => q.eq("projectId", pid))
      .collect();

    return rows.map((row) => ({
      _id: row._id,
      name: row.name,
      kind: row.kind,
      args: parseFieldsJson(row.argsJson as string),
    }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    kind: v.string(),
    args: v.array(argValidator),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { name, kind, args, projectId }) => {
    const { projectId: pid } = await resolveProjectScope(
      ctx,
      projectId ? String(projectId) : null
    );

    const fnName = name.trim();
    if (!fnName) throw new Error("Укажите имя функции");
    if (!FN_KINDS.includes(kind as (typeof FN_KINDS)[number])) {
      throw new Error("Тип: query или mutation");
    }

    const normalized: FieldDef[] = args.map((a) => ({
      name: a.name.trim(),
      type: a.type as FieldDef["type"],
    }));
    if (normalized.length > 0) {
      validateFields(normalized);
    }

    const slug = slugify(fnName);
    const existing = await ctx.db
      .query("projectFunctions")
      .withIndex("by_project_name", (q) => q.eq("projectId", pid))
      .filter((f) => f.name === fnName || slugify(f.name as string) === slug)
      .first();
    if (existing) throw new Error("Функция с таким именем уже есть");

    const id = await ctx.db.insert("projectFunctions", {
      projectId: pid,
      name: fnName,
      kind,
      argsJson: serializeFields(normalized),
    });

    return { _id: id, name: fnName, kind, args: normalized };
  },
});

export const remove = mutation({
  args: { id: v.id("projectFunctions") },
  handler: async (ctx, { id }) => {
    const userId = requireAuth(ctx);
    const docId = String(id);
    const row = await ctx.db.get("projectFunctions", docId);
    if (!row) throw new Error("Функция не найдена");

    await assertProjectMember(ctx, row.projectId as string, userId);
    await ctx.db.delete("projectFunctions", docId);
    return { ok: true };
  },
});
