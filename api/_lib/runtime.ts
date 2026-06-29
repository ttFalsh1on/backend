import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createJsonDatabase, createRuntime, type FlexRuntime } from "@flex/core";
import { schema } from "./todo/schema.js";
import { resolveAuth } from "./todo/lib/resolveAuth.js";
import * as authFns from "./todo/functions/auth.js";
import * as projectFns from "./todo/functions/projects.js";
import * as tableFns from "./todo/functions/tables.js";
import * as customFns from "./todo/functions/projectFns.js";

let runtime: FlexRuntime | null = null;

function createDb() {
  const jsonPath =
    process.env.FLEX_DB_PATH ?? join("/tmp", "flex-store.json");
  mkdirSync(dirname(jsonPath), { recursive: true });
  return createJsonDatabase(jsonPath, schema);
}

export function getRuntime(): FlexRuntime {
  if (runtime) return runtime;

  const db = createDb();
  const rt = createRuntime(db, {
    schema,
    auth: (opts) => resolveAuth(db, opts),
  });
  rt.registerModule("auth", authFns);
  rt.registerModule("projects", projectFns);
  rt.registerModule("tables", tableFns);
  rt.registerModule("projectFns", customFns);
  runtime = rt;
  return runtime;
}
