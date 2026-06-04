import { useCallback, useEffect, useState } from "react";
import { useFlexApi } from "./context.js";

export function useFlexQuery<T>(
  path: string,
  args: Record<string, unknown> = {}
): { data: T | undefined; error: Error | null; loading: boolean } {
  const api = useFlexApi();
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const argsKey = JSON.stringify(args);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = api.subscribe<T>(
      path,
      args,
      (value) => {
        setData(value);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [api, path, argsKey]);

  return { data, error, loading };
}

export function useFlexMutation<T, A extends Record<string, unknown> = Record<string, unknown>>(
  path: string
): {
  mutate: (args: A) => Promise<T>;
  loading: boolean;
  error: Error | null;
} {
  const api = useFlexApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (args: A) => {
      setLoading(true);
      setError(null);
      try {
        return (await api.mutation<T>(path, args)) as T;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [api, path]
  );

  return { mutate, loading, error };
}
