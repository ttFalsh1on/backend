import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FlexConfig } from "./config.js";
import { connectFlex, type ConnectFlexOptions, type FlexConnection } from "./connect.js";

export { defineModuleApi } from "./api.js";

const CONFIG_FILENAMES = ["flex.config.json", "flex.json"] as const;

/** Загрузить flex.config.json (только Node.js) */
export function loadFlexConfig(cwd = process.cwd()): Partial<FlexConfig> | undefined {
  for (const name of CONFIG_FILENAMES) {
    const path = resolve(cwd, name);
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf8");
      return JSON.parse(raw) as Partial<FlexConfig>;
    }
  }
  return undefined;
}

/** Подключение с автозагрузкой flex.config.json из cwd */
export function connectFlexFromConfig(
  options: ConnectFlexOptions = {},
  cwd = process.cwd()
): FlexConnection {
  const file = loadFlexConfig(cwd);
  return connectFlex(options, file);
}
