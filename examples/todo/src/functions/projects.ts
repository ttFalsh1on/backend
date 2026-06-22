import { mutation, query, v } from "@flex/core";
import {
  requireAuth,
  assertProjectMember,
  slugify,
} from "../lib/access.js";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = requireAuth(ctx);
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const result = [];
    for (const m of memberships) {
      const p = await ctx.db.get("projects", m.projectId as string);
      if (p) {
        result.push({
          _id: p._id,
          name: p.name,
          slug: p.slug,
          role: m.role,
          ownerId: p.ownerId,
        });
      }
    }
    return result;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, { name, slug }) => {
    const userId = requireAuth(ctx);
    const projectSlug = slug?.trim() || slugify(name);

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .filter((p) => p.slug === projectSlug)
      .first();
    if (existing) throw new Error("Проект с таким slug уже есть");

    const projectId = await ctx.db.insert("projects", {
      name: name.trim(),
      slug: projectSlug,
      ownerId: userId,
    });

    await ctx.db.insert("projectMembers", {
      projectId,
      userId,
      role: "owner",
    });

    return { _id: projectId, name: name.trim(), slug: projectSlug };
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = requireAuth(ctx);
    const id = String(projectId);
    await assertProjectMember(ctx, id, userId);
    const p = await ctx.db.get("projects", id);
    if (!p) throw new Error("Проект не найден");
    return p;
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = requireAuth(ctx);
    const id = String(projectId);
    const p = await ctx.db.get("projects", id);
    if (!p) throw new Error("Проект не найден");
    if (p.ownerId !== userId) throw new Error("Только владелец может удалить проект");

    const members = await ctx.db.query("projectMembers").collect();
    for (const m of members) {
      if (m.projectId === id) {
        await ctx.db.delete("projectMembers", m._id as string);
      }
    }

    await ctx.db.delete("projects", id);
    return { ok: true };
  },
});
