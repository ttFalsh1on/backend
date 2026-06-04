import { createClient, FlexClient, type FlexClientOptions } from "./client.js";
import {
  mergeConfig,
  resolveTokenFromEnv,
  type FlexConfig,
} from "./config.js";
import { createApi, type FlexApi } from "./api.js";

export interface ConnectFlexOptions extends Partial<FlexConfig> {
  token?: string;
  /** Не подключать WebSocket (только HTTP, для SSR/скриптов) */
  httpOnly?: boolean;
}

export interface FlexConnection {
  config: FlexConfig;
  client: FlexClient;
  api: FlexApi;
}

let defaultConnection: FlexConnection | null = null;

/**
 * Подключение к удалённому Flex-серверу из любого проекта.
 * URL: flex.config.json → аргументы → VITE_FLEX_URL / FLEX_URL
 */
export function connectFlex(
  options: ConnectFlexOptions = {},
  fileConfig?: Partial<FlexConfig>
): FlexConnection {
  const config = mergeConfig(fileConfig, options);
  const token =
    options.token ??
    resolveTokenFromEnv(config.tokenEnv);

  const clientOpts: FlexClientOptions = {
    url: config.url,
    token,
  };

  const client = options.httpOnly
    ? createHttpOnlyClient(clientOpts)
    : createClient(clientOpts);

  const connection: FlexConnection = {
    config,
    client,
    api: createApi(client),
  };

  return connection;
}

/** Singleton для приложения (React, Express и т.д.) */
export function initFlex(
  options?: ConnectFlexOptions,
  fileConfig?: Partial<FlexConfig>
): FlexConnection {
  defaultConnection = connectFlex(options ?? {}, fileConfig);
  return defaultConnection;
}

export function getFlex(): FlexConnection {
  if (!defaultConnection) {
    throw new Error(
      "Flex не инициализирован. Вызовите initFlex() или connectFlex() в точке входа приложения"
    );
  }
  return defaultConnection;
}

export function getFlexClient(): FlexClient {
  return getFlex().client;
}

export function getFlexApi(): FlexApi {
  return getFlex().api;
}

/** Клиент без WebSocket — только query/mutation через HTTP */
function createHttpOnlyClient(opts: FlexClientOptions): FlexClient {
  const base = opts.url.replace(/\/$/, "");
  const token = opts.token;

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  const httpClient = {
    httpUrl: base,
    query: async <T>(path: string, args: Record<string, unknown> = {}) => {
      const res = await fetch(`${base}/api/run`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ path, args }),
      });
      const data = (await res.json()) as { value?: T; error?: string };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      return data.value as T;
    },
    mutation: async <T>(path: string, args: Record<string, unknown> = {}) => {
      const res = await fetch(`${base}/api/run`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ path, args }),
      });
      const data = (await res.json()) as { value?: T; error?: string };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      return data.value as T;
    },
    subscribe: () => {
      throw new Error("subscribe недоступен в httpOnly режиме");
    },
    close: () => {},
  };
  return httpClient as unknown as FlexClient;
}
