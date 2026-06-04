import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "./_lib/cors.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  res.status(200).json({
    name: "Flex Backend on Vercel",
    endpoints: {
      "GET /api/health": "Health check",
      "GET /api/functions": "List functions",
      "POST /api/run": "Run query/mutation",
    },
    note: "WebSocket недоступен на Vercel — UI использует HTTP polling",
  });
}
