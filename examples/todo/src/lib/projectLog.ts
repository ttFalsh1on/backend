import type { FunctionContext } from "@flex/core";

export async function writeProjectLog(
  ctx: FunctionContext,
  projectId: string,
  level: string,
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await ctx.db.insert("projectLogs", {
    projectId,
    level,
    message,
    metaJson: meta ? JSON.stringify(meta) : "",
    createdAt: Date.now(),
  });
}
