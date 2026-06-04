import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  connectFlex,
  type FlexApi,
  type FlexClient,
  type FlexConfig,
  type ConnectFlexOptions,
} from "@flex/client";

export interface FlexProviderProps extends ConnectFlexOptions {
  children: ReactNode;
  /** Готовый api (если уже вызван initFlex) */
  api?: FlexApi;
  client?: FlexClient;
}

interface FlexContextValue {
  api: FlexApi;
  client: FlexClient;
  config: FlexConfig;
}

const FlexContext = createContext<FlexContextValue | null>(null);

export function FlexProvider({
  children,
  url,
  token,
  httpOnly,
  api: externalApi,
  client: externalClient,
}: FlexProviderProps): ReactNode {
  const value = useMemo(() => {
    if (externalApi && externalClient) {
      return {
        api: externalApi,
        client: externalClient,
        config: { url: url ?? "" },
      };
    }
    const conn = connectFlex({ url, token, httpOnly });
    return conn;
  }, [url, token, httpOnly, externalApi, externalClient]);

  return (
    <FlexContext.Provider value={value}>{children}</FlexContext.Provider>
  );
}

export function useFlexContext(): FlexContextValue {
  const ctx = useContext(FlexContext);
  if (!ctx) {
    throw new Error("useFlexContext: оберните приложение в <FlexProvider>");
  }
  return ctx;
}

export function useFlexApi(): FlexApi {
  return useFlexContext().api;
}
