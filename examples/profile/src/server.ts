import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDatabase, createRuntime } from "@flex/core";
import { createFlexServer } from "@flex/server";
import { schema } from "./schema.js";
import * as functions from "./functions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "flex.db");
// e:\бэкенд\examples\profile\src → четыре уровня вверх → e:\, затем папка сайта
const siteDir = join(__dirname, "..", "..", "..", "..", "тестовый сайт");

if (!existsSync(join(siteDir, "index.html"))) {
  console.warn(
    `Внимание: index.html не найден в ${siteDir}\n` +
      `Откройте http://localhost:3211/ после исправления пути.`
  );
}

const db = createDatabase(dbPath, schema);
const runtime = createRuntime(db, { schema });

runtime.registerModule("functions", functions);

const server = createFlexServer({
  runtime,
  port: 3211,
  publicDir: siteDir,
});

const { url } = await server.start();
console.log(`Flex profile backend: ${url}`);
console.log(`  Сайт:  ${url}/`);
console.log(`  API:   POST ${url}/api/run`);
