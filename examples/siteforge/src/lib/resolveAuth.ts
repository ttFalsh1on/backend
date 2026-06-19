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

  return {
    userId,
    email: (user.email as string | undefined) ?? "",
    name: user.name as string,
    token,
  };
}
