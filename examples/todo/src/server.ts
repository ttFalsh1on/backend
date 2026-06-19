import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase, createRuntime } from "@flex/core";
import { createFlexServer } from "@flex/server";
import { schema } from "./schema.js";
import { resolveAuth } from "./lib/resolveAuth.js";
import * as authFns from "./functions/auth.js";
import * as projectFns from "./functions/projects.js";
import * as todoFns from "./functions/todos.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "flex.db");

const db = createDatabase(dbPath, schema);
const runtime = createRuntime(db, {
  schema,
  auth: (opts) => resolveAuth(db, opts),
});

runtime.registerModule("auth", authFns);
runtime.registerModule("projects", projectFns);
runtime.registerModule("todos", todoFns);

const server = createFlexServer({ runtime, port: 3210 });

const { url } = await server.start();
console.log(`Flex API running at ${url}`);
console.log(`  POST ${url}/api/run`);
console.log(`  GET  ${url}/api/health`);
