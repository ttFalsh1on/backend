import { query, v } from "@flex/core";
import { resolveProjectScope } from "../lib/access.js";

export const list = query({
  args: { projectId: v.optional(v.id("projects")), limit: v.optional(v.number()) },
  handler: async (ctx, { projectId, limit }) => {
    const { projectId: pid } = await resolveProjectScope(
      ctx,
      projectId ? String(projectId) : null
    );

    const max = Math.min(limit ?? 100, 200);
    const rows = await ctx.db
      .query("projectLogs")
      .withIndex("by_project", (q) => q.eq("projectId", pid))
      .collect();

    return rows
      .sort((a, b) => (b.createdAt as number) - (a.createdAt as number))
      .slice(0, max)
      .map((r) => ({
        _id: r._id,
        level: r.level,
        message: r.message,
        meta: r.metaJson ? tryParse(r.metaJson as string) : null,
        createdAt: r.createdAt,
      }));
  },
});

function tryParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
