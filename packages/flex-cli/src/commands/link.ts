import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function linkCommand(url: string, cwd: string): Promise<void> {
  const path = join(cwd, "flex.config.json");
  const normalized = url.replace(/\/$/, "");

  let config: Record<string, unknown> = { url: normalized };

  if (existsSync(path)) {
    config = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    config.url = normalized;
  }

  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`Flex URL: ${normalized}`);
  console.log(`Обновлён ${path}`);
  console.log(`Добавьте в .env: VITE_FLEX_URL=${normalized}`);
}
