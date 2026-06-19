import { mutation, query, v } from "@flex/core";
import { requireAdmin, getProfileByUserId } from "../lib/requireAdmin.js";

export const promoteToAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const callerId = ctx.auth?.userId;
    const callerProfile = callerId
      ? await getProfileByUserId(ctx, callerId)
      : null;

    const profiles = await ctx.db.query("userProfiles").collect();
    const existingAdmins = profiles.find((p) => p.isAdmin === true);

    if (existingAdmins && !callerProfile?.isAdmin) {
      throw new Error("Только администратор может назначать других админов");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const profileByEmail = profiles.find(
      (p) => (p.email as string | undefined)?.toLowerCase() === normalizedEmail
    );

    if (profileByEmail) {
      await ctx.db.patch(profileByEmail._id as string, { isAdmin: true, isGuest: false });
      return { success: true, userId: profileByEmail.userId };
    }

    const users = await ctx.db.query("users").collect();
    const targetUser = users.find(
      (u) => (u.email as string | undefined)?.toLowerCase() === normalizedEmail
    );
    if (!targetUser) {
      throw new Error("Пользователь с таким email не найден. Сначала зарегистрируйтесь на сайте.");
    }

    const profile = await getProfileByUserId(ctx, targetUser._id as string);
    if (!profile) throw new Error("Профиль пользователя не найден");

    await ctx.db.patch(profile._id as string, { isAdmin: true, isGuest: false });
    return { success: true, userId: targetUser._id };
  },
});

export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth?.userId;
    if (!userId) return false;

    const profile = await getProfileByUserId(ctx, userId);
    return profile?.isAdmin ?? false;
  },
});

export const requireAdminCheck = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
      return true;
    } catch {
      return false;
    }
  },
});
