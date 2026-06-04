import type { FlexClient, Unsubscribe } from "./client.js";

/** Удобная обёртка над путями функций: "module:name" */
export interface FlexApi {
  query: <T = unknown>(
    path: string,
    args?: Record<string, unknown>
  ) => Promise<T>;
  mutation: <T = unknown>(
    path: string,
    args?: Record<string, unknown>
  ) => Promise<T>;
  subscribe: <T = unknown>(
    path: string,
    args: Record<string, unknown>,
    onData: (value: T) => void,
    onError?: (error: Error) => void
  ) => Unsubscribe;
  /** Список функций с сервера */
  listFunctions: () => Promise<
    Array<{ path: string; kind: string; args: string }>
  >;
  readonly client: FlexClient;
}

export function createApi(client: FlexClient): FlexApi {
  return {
    client,
    query: (path, args = {}) => client.query(path, args),
    mutation: (path, args = {}) => client.mutation(path, args),
    subscribe: (path, args, onData, onError) =>
      client.subscribe(path, args, onData, onError),
    listFunctions: async () => {
      const res = await fetch(`${client.httpUrl}/api/functions`);
      const data = (await res.json()) as {
        functions: Array<{ path: string; kind: string; args: string }>;
      };
      if (!res.ok) throw new Error("Failed to list functions");
      return data.functions;
    },
  };
}

/** Фабрика типизированных вызовов для конкретного модуля */
export function defineModuleApi<M extends string>(module: M, api: FlexApi) {
  const prefix = `${module}:` as const;
  return {
    query: <T = unknown>(
      name: string,
      args?: Record<string, unknown>
    ) => api.query<T>(`${prefix}${name}`, args),
    mutation: <T = unknown>(
      name: string,
      args?: Record<string, unknown>
    ) => api.mutation<T>(`${prefix}${name}`, args),
    subscribe: <T = unknown>(
      name: string,
      args: Record<string, unknown>,
      onData: (value: T) => void,
      onError?: (error: Error) => void
    ) => api.subscribe<T>(`${prefix}${name}`, args, onData, onError),
  };
}
