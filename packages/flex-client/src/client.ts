export type Unsubscribe = () => void;

export interface FlexClientOptions {
  url: string;
  token?: string;
}

type Listener<T> = (value: T) => void;
type ErrorListener = (error: Error) => void;

export class FlexClient {
  readonly httpUrl: string;
  private wsUrl: string;
  private token?: string;
  private ws?: WebSocket;
  private wsReady: Promise<void>;
  private wsResolve?: () => void;
  private pendingSubs = new Map<
    string,
    { onData: Listener<unknown>; onError?: ErrorListener }
  >();
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(options: FlexClientOptions) {
    const base = options.url.replace(/\/$/, "");
    this.httpUrl = base;
    this.wsUrl = base.replace(/^http/, "ws");
    this.token = options.token;
    this.wsReady = this.connectWs();
  }

  private connectWs(): Promise<void> {
    this.wsReady = new Promise((resolve) => {
      this.wsResolve = resolve;
    });

    if (typeof WebSocket === "undefined") {
      this.wsResolve?.();
      return this.wsReady;
    }

    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.wsResolve?.();
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as {
        type: string;
        subscriptionId?: string;
        value?: unknown;
        error?: string;
      };

      if (msg.type === "subscription_update" && msg.subscriptionId) {
        const sub = this.pendingSubs.get(msg.subscriptionId);
        sub?.onData(msg.value);
      }

      if (msg.type === "subscription_error" && msg.subscriptionId) {
        const sub = this.pendingSubs.get(msg.subscriptionId);
        sub?.onError?.(new Error(msg.error ?? "Subscription error"));
      }
    };

    ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => {
        void this.connectWs();
      }, 2000);
    };

    return this.wsReady;
  }

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  async query<T>(path: string, args: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(`${this.httpUrl}/api/run`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({ path, args }),
    });
    const data = (await res.json()) as { value?: T; error?: string };
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    return data.value as T;
  }

  async mutation<T>(
    path: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    await this.wsReady;
    if (this.ws?.readyState === WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            value?: T;
            error?: string;
          };
          if (msg.type === "mutation_result") {
            this.ws?.removeEventListener("message", handler);
            resolve(msg.value as T);
          }
          if (msg.type === "error") {
            this.ws?.removeEventListener("message", handler);
            reject(new Error(msg.error));
          }
        };
        this.ws!.addEventListener("message", handler);
        this.ws!.send(
          JSON.stringify({
            type: "mutation",
            path,
            args,
            token: this.token,
          })
        );
      });
    }
    const res = await fetch(`${this.httpUrl}/api/run`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({ path, args }),
    });
    const data = (await res.json()) as { value?: T; error?: string };
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    return data.value as T;
  }

  subscribe<T>(
    path: string,
    args: Record<string, unknown>,
    onData: Listener<T>,
    onError?: ErrorListener
  ): Unsubscribe {
    const subscriptionId = crypto.randomUUID();
    this.pendingSubs.set(subscriptionId, {
      onData: onData as Listener<unknown>,
      onError,
    });

    void this.wsReady.then(() => {
      this.ws?.send(
        JSON.stringify({
          type: "subscribe",
          subscriptionId,
          path,
          args,
          token: this.token,
        })
      );
    });

    return () => {
      this.pendingSubs.delete(subscriptionId);
      this.ws?.send(
        JSON.stringify({ type: "unsubscribe", subscriptionId })
      );
    };
  }

  close(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

export function createClient(options: FlexClientOptions): FlexClient {
  return new FlexClient(options);
}
