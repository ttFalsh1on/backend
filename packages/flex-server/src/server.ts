import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize, resolve } from "node:path";
import type { FlexRuntime } from "@flex/core";
import { WebSocketServer, type WebSocket } from "ws";
import { SyncEngine, type Subscription } from "./sync.js";

export interface FlexServerOptions {
  runtime: FlexRuntime;
  port?: number;
  host?: string;
  cors?: boolean;
  /** Папка со статикой (index.html на /) */
  publicDir?: string;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function setCors(res: ServerResponse, cors: boolean): void {
  if (cors) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Project-Id"
    );
  }
}

function json(
  res: ServerResponse,
  status: number,
  data: unknown,
  cors: boolean
): void {
  setCors(res, cors);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export class FlexServer {
  private runtime: FlexRuntime;
  private sync: SyncEngine;
  private port: number;
  private host: string;
  private cors: boolean;
  private publicDir?: string;
  private httpServer?: ReturnType<typeof createServer>;
  private wss?: WebSocketServer;

  constructor(options: FlexServerOptions) {
    this.runtime = options.runtime;
    this.sync = new SyncEngine(options.runtime);
    this.port = options.port ?? 3210;
    this.host = options.host ?? "0.0.0.0";
    this.cors = options.cors ?? true;
    this.publicDir = options.publicDir;
  }

  private tryServeStatic(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string
  ): boolean {
    if (!this.publicDir || req.method !== "GET") return false;

    const root = resolve(this.publicDir);
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    const safe = normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = resolve(join(this.publicDir, safe));

    if (!filePath.startsWith(root)) {
      json(res, 403, { error: "Forbidden" }, this.cors);
      return true;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return false;
    }

    const ext = extname(filePath);
    const mime = MIME[ext] ?? "application/octet-stream";
    setCors(res, this.cors);
    res.writeHead(200, { "Content-Type": mime });
    res.end(readFileSync(filePath));
    return true;
  }

  async start(): Promise<{ url: string; close: () => Promise<void> }> {
    this.httpServer = createServer((req, res) => void this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on("connection", (ws) => this.handleWs(ws));

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(this.port, this.host, resolve);
    });

    const url = `http://${this.host === "0.0.0.0" ? "localhost" : this.host}:${this.port}`;
    return {
      url,
      close: async () => {
        this.wss?.close();
        await new Promise<void>((resolve, reject) => {
          this.httpServer?.close((err) => (err ? reject(err) : resolve()));
        });
      },
    };
  }

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (this.cors && req.method === "OPTIONS") {
      json(res, 204, null, true);
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    try {
      if (this.tryServeStatic(req, res, url.pathname)) {
        return;
      }

      if (req.method === "GET" && url.pathname === "/api") {
        json(
          res,
          200,
          {
            name: "Flex Backend",
            endpoints: {
              "GET /api/health": "Проверка сервера",
              "GET /api/functions": "Список функций",
              "POST /api/run": 'Вызов функции: { "path": "functions:list", "args": {} }',
              "WS /": "Подписки и мутации в real-time",
            },
            example: {
              method: "POST",
              url: "/api/run",
              body: { path: "functions:list", args: {} },
            },
          },
          this.cors
        );
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/functions") {
        json(res, 200, { functions: this.runtime.listFunctions() }, this.cors);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/health") {
        json(res, 200, { ok: true }, this.cors);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/run") {
        const body = JSON.parse(await readBody(req)) as {
          path: string;
          args?: Record<string, unknown>;
        };
        const { value, tablesWritten } = await this.runtime.execute(
          body.path,
          body.args ?? {},
          this.parseExecuteOptions(req)
        );

        if (tablesWritten.length > 0) {
          await this.sync.invalidate(tablesWritten);
        }

        json(res, 200, { value }, this.cors);
        return;
      }

      json(res, 404, { error: "Not found" }, this.cors);
    } catch (err) {
      json(
        res,
        400,
        { error: err instanceof Error ? err.message : String(err) },
        this.cors
      );
    }
  }

  private parseExecuteOptions(req: IncomingMessage): {
    token: string | null;
    projectId: string | null;
  } {
    const auth = req.headers.authorization;
    const token =
      typeof auth === "string" ? auth.replace(/^Bearer\s+/i, "") : null;
    const raw = req.headers["x-project-id"];
    const projectId = typeof raw === "string" ? raw : null;
    return { token, projectId };
  }

  private handleWs(ws: WebSocket): void {
    ws.on("message", (raw) => {
      void this.handleWsMessage(ws, raw.toString());
    });
    ws.on("close", () => {
      this.sync.removeBySocket(ws);
    });
  }

  private async handleWsMessage(ws: WebSocket, raw: string): Promise<void> {
    try {
      const msg = JSON.parse(raw) as {
        type: string;
        subscriptionId?: string;
        path?: string;
        args?: Record<string, unknown>;
        token?: string;
        projectId?: string;
      };

      if (msg.type === "subscribe" && msg.path) {
        const id = msg.subscriptionId ?? randomUUID();
        const sub: Subscription = {
          id,
          path: msg.path,
          args: msg.args ?? {},
          token: msg.token,
          projectId: msg.projectId,
          ws,
        };
        this.sync.add(sub);
        await this.sync.pushInitial(sub);
        ws.send(JSON.stringify({ type: "subscribed", subscriptionId: id }));
        return;
      }

      if (msg.type === "unsubscribe" && msg.subscriptionId) {
        this.sync.remove(msg.subscriptionId);
        return;
      }

      if (msg.type === "mutation" && msg.path) {
        const { value, tablesWritten } = await this.runtime.execute(
          msg.path,
          msg.args ?? {},
          { token: msg.token ?? null, projectId: msg.projectId ?? null }
        );
        if (tablesWritten.length > 0) {
          await this.sync.invalidate(tablesWritten);
        }
        ws.send(
          JSON.stringify({
            type: "mutation_result",
            value,
          })
        );
        return;
      }
    } catch (err) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
}

export function createFlexServer(options: FlexServerOptions): FlexServer {
  return new FlexServer(options);
}
