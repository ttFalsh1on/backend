import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase, createRuntime } from "@flex/core";
import { schema } from "../src/schema.js";
import { resolveAuth } from "../src/lib/resolveAuth.js";
import * as adminFns from "../src/functions/admins.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run promote-admin -- email@example.com");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "flex.db");

const db = createDatabase(dbPath, schema);
const runtime = createRuntime(db, {
  schema,
  auth: (opts) => resolveAuth(db, opts),
});
runtime.registerModule("admins", adminFns);

const result = await runtime.execute("admins:promoteToAdmin", { email }, {});
console.log(result.value);
