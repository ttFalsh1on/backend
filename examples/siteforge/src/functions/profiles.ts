import { mutation, query, v } from "@flex/core";
import { requireAuth } from "../lib/access.js";
import { getProfileByUserId } from "../lib/requireAdmin.js";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth?.userId;
    if (!userId) return null;

    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) return null;

    const orders = await ctx.db.query("orders").collect();
    const userOrders = orders
      .filter((order) => order.userId === userId)
      .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));

    const stats = {
      total: userOrders.length,
      active: userOrders.filter((order) => order.status === "in_progress").length,
      completed: userOrders.filter((order) => order.status === "done").length,
    };

    return {
      profile,
      orders: userOrders,
      stats,
      avatarUrl: (profile.avatarUrl as string | undefined) ?? null,
      isGuest: profile.isGuest,
      isAdmin: profile.isAdmin ?? false,
    };
  },
});

export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = requireAuth(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user) throw new Error("Пользователь не найден");

    const existing = await getProfileByUserId(ctx, userId);
    if (existing) {
      if (!user.isGuest && existing.isGuest) {
        await ctx.db.patch(existing._id as string, {
          isGuest: false,
          email: (user.email as string | undefined) ?? existing.email,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId,
      name: user.isGuest ? "Гость SiteForge" : "Пользователь SiteForge",
      email: user.email as string | undefined,
      isGuest: user.isGuest ?? false,
      isAdmin: false,
    });
  },
});

export const completeRegistration = mutation({
  args: {
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { name, email }) => {
    const userId = requireAuth(ctx);
    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) throw new Error("Профиль не найден");

    await ctx.db.patch(profile._id as string, {
      name: name.trim(),
      email: email.trim(),
      isGuest: false,
    });

    return profile._id;
  },
});

export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = requireAuth(ctx);
    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) throw new Error("Профиль не найден");

    await ctx.db.patch(profile._id as string, { name: name.trim() });
    await ctx.db.patch(userId, { name: name.trim() });
  },
});

export const saveAvatar = mutation({
  args: { avatarUrl: v.string() },
  handler: async (ctx, { avatarUrl }) => {
    const userId = requireAuth(ctx);
    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) throw new Error("Профиль не найден");

    await ctx.db.patch(profile._id as string, { avatarUrl });
    return avatarUrl;
  },
});
