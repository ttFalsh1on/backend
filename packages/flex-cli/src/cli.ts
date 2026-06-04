#!/usr/bin/env node
import { initCommand } from "./commands/init.js";
import { linkCommand } from "./commands/link.js";
import { codegenCommand } from "./commands/codegen.js";

const [, , cmd, ...args] = process.argv;

async function main(): Promise<void> {
  switch (cmd) {
    case "init":
      await initCommand(args[0] || process.cwd());
      break;
    case "link": {
      const url = args[0];
      if (!url) {
        console.error("Использование: flex link <url>");
        console.error("Пример: flex link http://localhost:3210");
        process.exit(1);
      }
      await linkCommand(url, process.cwd());
      break;
    }
    case "codegen":
      await codegenCommand(process.cwd(), args[0]);
      break;
    case undefined:
    case "help":
    case "-h":
    case "--help":
      printHelp();
      break;
    default:
      console.error(`Неизвестная команда: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
Flex CLI — подключение внешних проектов к бэкенду

  flex init [папка]     Создать flex.config.json и lib/flex.ts
  flex link <url>       Указать URL сервера в flex.config.json
  flex codegen [модуль] Сгенерировать src/flex/api.generated.ts

Переменные окружения в клиентском проекте:
  VITE_FLEX_URL, NEXT_PUBLIC_FLEX_URL, FLEX_URL
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
