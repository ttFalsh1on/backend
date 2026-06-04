import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_lib/cors.js";

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  setCors(res);
  res.status(200).json({ ok: true });
}
