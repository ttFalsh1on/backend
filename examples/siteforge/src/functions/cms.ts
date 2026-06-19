import { mutation, query, v } from "@flex/core";
import { requireAdmin } from "../lib/requireAdmin.js";

const blockMeta = v.optional(
  v.object({
    href: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    slot: v.optional(v.string()),
    align: v.optional(v.string()),
  })
);

function enrichBlock(block: Record<string, unknown>) {
  return {
    ...block,
    imageUrl: (block.imageUrl as string | undefined) ?? null,
    videoUrl:
      (block.videoUrl as string | undefined) ??
      ((block.meta as { videoUrl?: string } | undefined)?.videoUrl ?? null),
  };
}

async function findBlockByPageKey(
  ctx: { db: { query: Function } },
  page: string,
  key: string
) {
  const blocks = await ctx.db
    .query("cmsBlocks")
    .withIndex("by_page", (q: { eq: (f: string, v: string) => unknown }) => q.eq("page", page))
    .collect();
  return blocks.find((b: { key: string }) => b.key === key) ?? null;
}

export const listByPage = query({
  args: { page: v.string() },
  handler: async (ctx, { page }) => {
    const blocks = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_page", (q) => q.eq("page", page))
      .collect();

    return blocks
      .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
      .map((block) => enrichBlock(block));
  },
});

export const upsert = mutation({
  args: {
    page: v.string(),
    key: v.string(),
    type: v.string(),
    value: v.string(),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    meta: blockMeta,
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await findBlockByPageKey(ctx, args.page, args.key);

    if (existing) {
      await ctx.db.patch(existing._id as string, {
        type: args.type,
        value: args.value,
        imageUrl: args.imageUrl,
        videoUrl: args.videoUrl,
        meta: args.meta,
        sortOrder: args.sortOrder ?? existing.sortOrder,
      });
      return existing._id;
    }

    const pageBlocks = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_page", (q) => q.eq("page", args.page))
      .collect();
    const maxOrder = pageBlocks.reduce(
      (max, b) => Math.max(max, b.sortOrder as number),
      -1
    );

    return await ctx.db.insert("cmsBlocks", {
      page: args.page,
      key: args.key,
      type: args.type,
      value: args.value,
      imageUrl: args.imageUrl,
      videoUrl: args.videoUrl,
      meta: args.meta,
      sortOrder: args.sortOrder ?? maxOrder + 1,
    });
  },
});

export const remove = mutation({
  args: { page: v.string(), key: v.string() },
  handler: async (ctx, { page, key }) => {
    await requireAdmin(ctx);

    const existing = await findBlockByPageKey(ctx, page, key);
    if (!existing) return;
    await ctx.db.delete("cmsBlocks", existing._id as string);
  },
});
