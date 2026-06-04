import { mutation, query, v } from "@flex/core";
import {
  requireAuth,
  requireProject,
  assertProjectMember,
} from "../lib/access.js";

export const list = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { projectId }) => {
    const userId = requireAuth(ctx);
    const pid = projectId
      ? String(projectId)
      : requireProject(ctx);

    await assertProjectMember(ctx, pid, userId);

    return ctx.db
      .query("todos")
      .withIndex("by_project", (q) => q.eq("projectId", pid))
      .order("desc")
      .collect();
  },
});

export const add = mutation({
  args: { text: v.string(), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { text, projectId }) => {
    const userId = requireAuth(ctx);
    const pid = projectId ? String(projectId) : requireProject(ctx);
    await assertProjectMember(ctx, pid, userId);

    return ctx.db.insert("todos", {
      projectId: pid,
      text: text.trim(),
      completed: false,
      createdBy: userId,
    });
  },
});

export const toggle = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, { id }) => {
    const userId = requireAuth(ctx);
    const docId = String(id);
    const doc = await ctx.db.get("todos", docId);
    if (!doc) throw new Error("Задача не найдена");

    await assertProjectMember(ctx, doc.projectId as string, userId);
    await ctx.db.patch("todos", docId, { completed: !doc.completed });
    return docId;
  },
});

export const remove = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, { id }) => {
    const userId = requireAuth(ctx);
    const docId = String(id);
    const doc = await ctx.db.get("todos", docId);
    if (!doc) throw new Error("Задача не найдена");

    await assertProjectMember(ctx, doc.projectId as string, userId);
    await ctx.db.delete("todos", docId);
  },
});
