import { mutation, query, v } from "@flex/core";

export const PROFILE_KEY = "default";

export const DEFAULT_PROFILE = {
  name: "Алексей Петров",
  email: "alexey@example.com",
  bio: "Люблю простые и удобные сайты.",
};

export const get = query({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, { key }) => {
    const profileKey = key ?? PROFILE_KEY;
    const doc = await ctx.db
      .query("profiles")
      .withIndex("by_key", (q) => q.eq("key", profileKey))
      .first();

    if (!doc) return { ...DEFAULT_PROFILE, key: profileKey };

    return {
      key: doc.key as string,
      name: doc.name as string,
      email: doc.email as string,
      bio: doc.bio as string,
    };
  },
});

export const save = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    bio: v.string(),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { name, email, bio, key }) => {
    const profileKey = key ?? PROFILE_KEY;
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_key", (q) => q.eq("key", profileKey))
      .first();

    const fields = { key: profileKey, name, email, bio };

    if (existing) {
      await ctx.db.patch("profiles", existing._id as string, fields);
    } else {
      await ctx.db.insert("profiles", fields);
    }

    return fields;
  },
});

export const reset = mutation({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, { key }) => {
    const profileKey = key ?? PROFILE_KEY;
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_key", (q) => q.eq("key", profileKey))
      .first();

    if (existing) {
      await ctx.db.delete("profiles", existing._id as string);
    }

    return { ...DEFAULT_PROFILE, key: profileKey };
  },
});
