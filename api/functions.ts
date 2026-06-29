import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_lib/cors.js";
import { getRuntime } from "./_lib/runtime.js";
import { apiErrorStatus } from "./_lib/errors.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const functions = (await getRuntime()).listFunctions();
    res.status(200).json({ functions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(apiErrorStatus(message)).json({ error: message });
  }
}
