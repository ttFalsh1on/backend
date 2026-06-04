export interface FlexConfig {
  /** URL Flex-сервера, например http://localhost:3210 */
  url: string;
  /** Имя проекта / deployment (для документации и codegen) */
  project?: string;
  /** Переменная окружения с Bearer-токеном (по умолчанию FLEX_TOKEN) */
  tokenEnv?: string;
  /** Путь к flex.config.json относительно cwd */
  configPath?: string;
}

const DEFAULT_TOKEN_ENV = "FLEX_TOKEN";

/** Переменные окружения для URL (порядок приоритета при auto-resolve) */
export const FLEX_URL_ENV_KEYS = [
  "FLEX_URL",
  "VITE_FLEX_URL",
  "NEXT_PUBLIC_FLEX_URL",
  "PUBLIC_FLEX_URL",
  "REACT_APP_FLEX_URL",
] as const;

export function resolveUrlFromEnv(
  env: Record<string, string | undefined> = getEnvRecord()
): string | undefined {
  for (const key of FLEX_URL_ENV_KEYS) {
    const v = env[key];
    if (v?.trim()) return v.trim().replace(/\/$/, "");
  }
  return undefined;
}

export function resolveTokenFromEnv(
  tokenEnv = DEFAULT_TOKEN_ENV,
  env: Record<string, string | undefined> = getEnvRecord()
): string | undefined {
  return env[tokenEnv]?.trim() || undefined;
}

function getEnvRecord(): Record<string, string | undefined> {
  if (typeof process !== "undefined" && process.env) {
    return process.env as Record<string, string | undefined>;
  }
  return {};
}

/** Браузер: Vite / Next public env через import.meta */
export function resolveUrlFromImportMeta(): string | undefined {
  try {
    const meta = import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    };
    if (!meta.env) return undefined;
    return resolveUrlFromEnv(meta.env);
  } catch {
    return undefined;
  }
}

export function mergeConfig(
  file?: Partial<FlexConfig>,
  overrides?: Partial<FlexConfig>
): FlexConfig {
  const url =
    overrides?.url ??
    file?.url ??
    resolveUrlFromImportMeta() ??
    resolveUrlFromEnv();

  if (!url) {
    throw new Error(
      "Flex URL не задан. Укажите url в flex.config.json, FLEX_URL или VITE_FLEX_URL в .env"
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    project: overrides?.project ?? file?.project,
    tokenEnv: overrides?.tokenEnv ?? file?.tokenEnv ?? DEFAULT_TOKEN_ENV,
    configPath: overrides?.configPath ?? file?.configPath,
  };
}
