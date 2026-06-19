import type { FunctionContext } from "@flex/core";
import { requireAuth } from "./access.js";

export async function requireAdmin(ctx: FunctionContext): Promise<string> {
  const userId = requireAuth(ctx);

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  if (!profile?.isAdmin) throw new Error("Доступ запрещён");

  return userId;
}

async function getProfileByUserId(ctx: FunctionContext, userId: string) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

export { getProfileByUserId };
