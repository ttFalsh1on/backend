import type { FlexRuntime } from "@flex/core";
import type { WebSocket } from "ws";

export interface Subscription {
  id: string;
  path: string;
  args: Record<string, unknown>;
  token?: string | null;
  projectId?: string | null;
  ws: WebSocket;
}

export class SyncEngine {
  private subscriptions = new Map<string, Subscription>();
  private runtime: FlexRuntime;

  constructor(runtime: FlexRuntime) {
    this.runtime = runtime;
  }

  add(sub: Subscription): void {
    this.subscriptions.set(sub.id, sub);
  }

  remove(id: string): void {
    this.subscriptions.delete(id);
  }

  removeBySocket(ws: WebSocket): void {
    for (const [id, sub] of this.subscriptions) {
      if (sub.ws === ws) {
        this.subscriptions.delete(id);
      }
    }
  }

  async pushInitial(sub: Subscription): Promise<void> {
    try {
      const { value } = await this.runtime.execute(sub.path, sub.args, {
        token: sub.token,
        projectId: sub.projectId,
      });
      this.send(sub.ws, {
        type: "subscription_update",
        subscriptionId: sub.id,
        value,
      });
    } catch (err) {
      this.send(sub.ws, {
        type: "subscription_error",
        subscriptionId: sub.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async invalidate(_tablesWritten: string[]): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      const fn = this.runtime.getFunction(sub.path);
      if (!fn || fn.kind !== "query") continue;

      try {
        const { value } = await this.runtime.execute(sub.path, sub.args, {
          token: sub.token,
          projectId: sub.projectId,
        });
        this.send(sub.ws, {
          type: "subscription_update",
          subscriptionId: sub.id,
          value,
        });
      } catch (err) {
        this.send(sub.ws, {
          type: "subscription_error",
          subscriptionId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private send(ws: WebSocket, msg: object): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
