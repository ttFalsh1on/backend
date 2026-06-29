import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "@flex/core/sqlite";
import { createRuntime } from "@flex/core";
import { createFlexServer } from "@flex/server";
import { schema } from "./schema.js";
import { resolveAuth } from "./lib/resolveAuth.js";
import * as authFns from "./functions/auth.js";
import * as projectFns from "./functions/projects.js";
import * as tableFns from "./functions/tables.js";
import * as customFns from "./functions/projectFns.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "flex.db");

const db = createDatabase(dbPath, schema);
const runtime = createRuntime(db, {
  schema,
  auth: (opts) => resolveAuth(db, opts),
});

runtime.registerModule("auth", authFns);
runtime.registerModule("projects", projectFns);
runtime.registerModule("tables", tableFns);
runtime.registerModule("projectFns", customFns);

const publicDir = join(__dirname, "..", "public");
const server = createFlexServer({ runtime, port: 3210, publicDir });

const { url } = await server.start();
console.log(`Flex backend running at ${url}`);
console.log(`  UI:    ${url}/`);
console.log(`  API:   POST ${url}/api/run`);
