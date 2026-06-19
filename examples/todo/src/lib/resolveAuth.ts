import type { ExecuteOptions, AuthContext, DatabaseReader } from "@flex/core";

export async function resolveAuth(
  db: DatabaseReader,
  options: ExecuteOptions
): Promise<AuthContext | null> {
  const token = options.token?.trim();
  if (!token) return null;

  const session = await db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  if (!session) return null;
  if ((session.expiresAt as number) < Date.now()) return null;

  const userId = session.userId as string;
  const user = await db.get("users", userId);
  if (!user) return null;

  let projectId = options.projectId?.trim() || undefined;
  if (projectId) {
    const member = await db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", projectId!))
      .filter((m) => m.userId === userId)
      .first();
    if (!member) projectId = undefined;
  }

  return {
    userId,
    email: user.email as string,
    name: user.name as string,
    projectId,
    token,
  };
}
