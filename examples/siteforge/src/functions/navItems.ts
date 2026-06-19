import { mutation, query, v } from "@flex/core";
import type { FunctionContext } from "@flex/core";
import { requireAdmin } from "../lib/requireAdmin.js";

function slugifyLabel(label: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  let result = "";
  for (const char of label.trim().toLowerCase()) {
    if (map[char]) result += map[char];
    else if (/[a-z0-9]/.test(char)) result += char;
    else if (/\s|[-_]/.test(char)) result += "-";
  }
  return result.replace(/-+/g, "-").replace(/^-|-$/g, "") || "page";
}

async function uniqueSlug(ctx: FunctionContext, base: string) {
  const all = await ctx.db.query("navItems").collect();
  let slug = base;
  let n = 0;
  while (all.some((i) => i.path === `/p/${slug}`)) {
    n++;
    slug = `${base}-${n}`;
  }
  return slug;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("navItems").collect();
    return items.sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));
  },
});

export const create = mutation({
  args: {
    path: v.string(),
    label: v.string(),
    icon: v.string(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const allNav = await ctx.db.query("navItems").collect();
    const maxOrder = allNav.reduce(
      (max, item) => Math.max(max, item.sortOrder as number),
      -1
    );
    return await ctx.db.insert("navItems", {
      ...args,
      sortOrder: args.sortOrder ?? maxOrder + 1,
    });
  },
});

export const createCustomPage = mutation({
  args: {
    label: v.string(),
    icon: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, { label, icon, slug: providedSlug }) => {
    await requireAdmin(ctx);

    const base = providedSlug?.trim() || slugifyLabel(label);
    const slug = await uniqueSlug(ctx, base);
    const path = `/p/${slug}`;
    const page = `p.${slug}`;

    const allNav = await ctx.db.query("navItems").collect();
    const maxOrder = allNav.reduce(
      (max, item) => Math.max(max, item.sortOrder as number),
      -1
    );
    const navId = await ctx.db.insert("navItems", {
      path,
      label: label.trim(),
      icon: icon?.trim() || "📄",
      sortOrder: maxOrder + 1,
    });

    await ctx.db.insert("cmsBlocks", {
      page,
      key: "page.title",
      type: "text",
      value: label.trim(),
      sortOrder: 0,
    });
    await ctx.db.insert("cmsBlocks", {
      page,
      key: "page.description",
      type: "text",
      value: "Добавьте описание или контент через кнопку +",
      sortOrder: 1,
    });

    return { navId, path, page, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("navItems"),
    path: v.optional(v.string()),
    label: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireAdmin(ctx);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);

    if (fields.label) {
      const item = await ctx.db.get("navItems", id);
      if (item?.path && (item.path as string).startsWith("/p/")) {
        const page = `p.${(item.path as string).slice(3)}`;
        const pageBlocks = await ctx.db
          .query("cmsBlocks")
          .withIndex("by_page", (q) => q.eq("page", page))
          .collect();
        const titleBlock = pageBlocks.find((b) => b.key === "page.title");
        if (titleBlock) {
          await ctx.db.patch(titleBlock._id as string, { value: fields.label.trim() });
        }
      }
    }
  },
});

export const remove = mutation({
  args: { id: v.id("navItems") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("navItems").collect();
    if (all.length <= 1) throw new Error("Нельзя удалить последний пункт меню");

    const item = await ctx.db.get("navItems", id);
    if (!item) return;

    if ((item.path as string).startsWith("/p/")) {
      const page = `p.${(item.path as string).slice(3)}`;
      const blocks = await ctx.db
        .query("cmsBlocks")
        .withIndex("by_page", (q) => q.eq("page", page))
        .collect();
      for (const block of blocks) {
        await ctx.db.delete("cmsBlocks", block._id as string);
      }
    }

    await ctx.db.delete("navItems", id);
  },
});
