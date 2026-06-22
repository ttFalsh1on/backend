import { mutation, query, v } from "@flex/core";
import {
  requireAuth,
  assertProjectMember,
  resolveProjectScope,
  slugify,
} from "../lib/access.js";
import {
  parseFieldsJson,
  serializeFields,
  validateFields,
  type FieldDef,
} from "../lib/fieldTypes.js";

const fieldValidator = v.object({
  name: v.string(),
  type: v.string(),
});

export const list = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { projectId }) => {
    const { projectId: pid } = await resolveProjectScope(
      ctx,
      projectId ? String(projectId) : null
    );

    const rows = await ctx.db
      .query("projectTables")
      .withIndex("by_project", (q) => q.eq("projectId", pid))
      .collect();

    return rows.map((row) => ({
      _id: row._id,
      name: row.name,
      fields: parseFieldsJson(row.fieldsJson as string),
    }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    fields: v.array(fieldValidator),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { name, fields, projectId }) => {
    const { projectId: pid } = await resolveProjectScope(
      ctx,
      projectId ? String(projectId) : null
    );

    const tableName = name.trim();
    if (!tableName) throw new Error("Укажите имя таблицы");

    const normalized: FieldDef[] = fields.map((f) => ({
      name: f.name.trim(),
      type: f.type as FieldDef["type"],
    }));
    validateFields(normalized);

    const slug = slugify(tableName);
    const existing = await ctx.db
      .query("projectTables")
      .withIndex("by_project_name", (q) => q.eq("projectId", pid))
      .filter((t) => t.name === tableName || slugify(t.name as string) === slug)
      .first();
    if (existing) throw new Error("Таблица с таким именем уже есть");

    const id = await ctx.db.insert("projectTables", {
      projectId: pid,
      name: tableName,
      fieldsJson: serializeFields(normalized),
    });

    return { _id: id, name: tableName, fields: normalized };
  },
});

export const remove = mutation({
  args: { id: v.id("projectTables") },
  handler: async (ctx, { id }) => {
    const userId = requireAuth(ctx);
    const docId = String(id);
    const row = await ctx.db.get("projectTables", docId);
    if (!row) throw new Error("Таблица не найдена");

    await assertProjectMember(ctx, row.projectId as string, userId);
    await ctx.db.delete("projectTables", docId);
    return { ok: true };
  },
});
