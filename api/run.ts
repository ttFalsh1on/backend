import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_lib/cors.js";
import { getRuntime } from "./_lib/runtime.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const path = body?.path as string;
    const args = (body?.args ?? {}) as Record<string, unknown>;
    if (!path) {
      res.status(400).json({ error: "Missing path" });
      return;
    }

    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === "string"
        ? authHeader.replace(/^Bearer\s+/i, "")
        : null;
    const projectHeader = req.headers["x-project-id"];
    const projectId =
      typeof projectHeader === "string" ? projectHeader : null;

    const { value } = await getRuntime().execute(path, args, {
      token,
      projectId,
    });
    res.status(200).json({ value });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
