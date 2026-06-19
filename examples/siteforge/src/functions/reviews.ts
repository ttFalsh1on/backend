import { mutation, query, v } from "@flex/core";
import { requireAdmin } from "../lib/requireAdmin.js";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("reviews").collect();
    return items.sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));
  },
});

export const averageRating = query({
  args: {},
  handler: async (ctx) => {
    const reviews = await ctx.db.query("reviews").collect();
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + (review.rating as number), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    text: v.string(),
    rating: v.number(),
    date: v.string(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("reviews").collect();
    const maxOrder = all.reduce(
      (max, item) => Math.max(max, item.sortOrder as number),
      -1
    );
    return await ctx.db.insert("reviews", {
      ...args,
      sortOrder: args.sortOrder ?? maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("reviews"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    text: v.optional(v.string()),
    rating: v.optional(v.number()),
    date: v.optional(v.string()),
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
  args: { id: v.id("reviews") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete("reviews", id);
  },
});
