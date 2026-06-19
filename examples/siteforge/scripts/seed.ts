import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase, createRuntime } from "@flex/core";
import { schema } from "../src/schema.js";
import { resolveAuth } from "../src/lib/resolveAuth.js";
import * as seedFns from "../src/functions/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "flex.db");

const db = createDatabase(dbPath, schema);
const runtime = createRuntime(db, {
  schema,
  auth: (opts) => resolveAuth(db, opts),
});
runtime.registerModule("seed", seedFns);

const result = await runtime.execute("seed:seedIfEmpty", {}, {});
console.log(result.value);
