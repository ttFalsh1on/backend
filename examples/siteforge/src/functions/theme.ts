import { mutation, query, v } from "@flex/core";
import { requireAdmin } from "../lib/requireAdmin.js";

const DEFAULT_COLORS: Record<string, string> = {
  cyberBg: "#0a0a0a",
  cyberCyan: "#00ffff",
  cyberMagenta: "#ff00ff",
  cyberGreen: "#39ff14",
  cyberPurple: "#1a0033",
  accentPurple: "#bb86fc",
  accentPurpleHover: "#cfa9ff",
  accentTeal: "#03dac6",
  glassBg: "rgba(255, 255, 255, 0.12)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  glassHover: "rgba(255, 255, 255, 0.18)",
  sidebar: "#1a1a2e",
  sidebarHover: "#252547",
  sidebarActive: "#4361ee",
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const stored = await ctx.db
      .query("siteTheme")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    return { ...DEFAULT_COLORS, ...((stored?.colors as Record<string, string> | undefined) ?? {}) };
  },
});

export const update = mutation({
  args: {
    colors: v.any(),
  },
  handler: async (ctx, { colors }) => {
    await requireAdmin(ctx);

    if (typeof colors !== "object" || colors === null || Array.isArray(colors)) {
      throw new Error("colors должен быть объектом");
    }

    const existing = await ctx.db
      .query("siteTheme")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id as string, {
        colors: { ...(existing.colors as Record<string, string>), ...(colors as Record<string, string>) },
      });
      return existing._id;
    }

    return await ctx.db.insert("siteTheme", { key: "default", colors });
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("siteTheme")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    if (existing) {
      await ctx.db.delete("siteTheme", existing._id as string);
    }
  },
});
