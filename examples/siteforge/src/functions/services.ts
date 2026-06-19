import { mutation, query, v } from "@flex/core";
import { requireAdmin } from "../lib/requireAdmin.js";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("services").collect();
    return items.sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    price: v.string(),
    features: v.array(v.string()),
    badge: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("services").collect();
    const maxOrder = all.reduce(
      (max, item) => Math.max(max, item.sortOrder as number),
      -1
    );
    return await ctx.db.insert("services", {
      ...args,
      sortOrder: args.sortOrder ?? maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("services"),
    slug: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.string()),
    features: v.optional(v.array(v.string())),
    badge: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireAdmin(ctx);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete("services", id);
  },
});
