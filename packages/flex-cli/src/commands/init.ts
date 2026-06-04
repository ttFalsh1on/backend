import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const FLEX_CONFIG = `{
  "$schema": "https://flex.dev/schema/config.json",
  "url": "http://localhost:3210",
  "project": "my-app"
}
`;

const ENV_EXAMPLE = `# URL вашего Flex-сервера
VITE_FLEX_URL=http://localhost:3210
# FLEX_TOKEN=optional-auth-token
`;

const FLEX_LIB = `/**
 * Подключение к Flex Backend.
 * @see https://github.com/your-org/flex-backend
 */
import { initFlex, defineModuleApi } from "@flex/client";

const { api, client, config } = initFlex({
  // url переопределяется из VITE_FLEX_URL / flex.config.json при сборке
});

export { api, client, config };

/** API модуля functions на сервере */
export const fn = defineModuleApi("functions", api);
`;

const FLEX_LIB_NODE = `import { connectFlexFromConfig, defineModuleApi } from "@flex/client/node";

export const { api, client, config } = connectFlexFromConfig();
export const fn = defineModuleApi("functions", api);
`;

export async function initCommand(targetDir: string): Promise<void> {
  const root = resolve(targetDir);
  const libDir = join(root, "src", "lib");

  if (existsSync(join(root, "flex.config.json"))) {
    console.log("flex.config.json уже существует — пропуск");
  } else {
    writeFileSync(join(root, "flex.config.json"), FLEX_CONFIG, "utf8");
    console.log("Создан flex.config.json");
  }

  mkdirSync(libDir, { recursive: true });

  const flexTs = join(libDir, "flex.ts");
  if (!existsSync(flexTs)) {
    writeFileSync(flexTs, FLEX_LIB, "utf8");
    console.log("Создан src/lib/flex.ts");
  }

  const flexNodeTs = join(libDir, "flex.node.ts");
  if (!existsSync(flexNodeTs)) {
    writeFileSync(flexNodeTs, FLEX_LIB_NODE, "utf8");
    console.log("Создан src/lib/flex.node.ts (для Node-скриптов)");
  }

  const envPath = join(root, ".env.example");
  if (!existsSync(envPath)) {
    writeFileSync(envPath, ENV_EXAMPLE, "utf8");
    console.log("Создан .env.example");
  }

  console.log(`
Дальше:
  1. npm install @flex/client
     или в monorepo: "@flex/client": "file:../path/to/packages/flex-client"
  2. Скопируйте .env.example → .env
  3. import { fn } from "./lib/flex";
     await fn.query("list");
`);
}
