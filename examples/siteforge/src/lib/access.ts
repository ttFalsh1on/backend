import type { FunctionContext } from "@flex/core";

export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function requireAuth(ctx: FunctionContext): string {
  if (!ctx.auth?.userId) {
    throw new Error("Требуется вход в аккаунт");
  }
  return ctx.auth.userId;
}
