import type { FunctionContext } from "@flex/core";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export { SESSION_MS };

export function requireAuth(ctx: FunctionContext): string {
  if (!ctx.auth?.userId) {
    throw new Error("Требуется вход в аккаунт");
  }
  return ctx.auth.userId;
}

export function requireProject(ctx: FunctionContext): string {
  const userId = requireAuth(ctx);
  const projectId = ctx.auth?.projectId;
  if (!projectId) {
    throw new Error("Выберите проект (заголовок X-Project-Id)");
  }
  return projectId;
}

export async function assertProjectMember(
  ctx: FunctionContext,
  projectId: string,
  userId: string
): Promise<void> {
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId))
    .filter((m) => m.userId === userId)
    .first();
  if (!member) {
    throw new Error("Нет доступа к этому проекту");
  }
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "project"
  );
}
