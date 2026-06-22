import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import {
  createDatabase,
  createJsonDatabase,
  createRuntime,
  type FlexRuntime,
} from "@flex/core";
import { schema } from "../../examples/todo/src/schema";
import { resolveAuth } from "../../examples/todo/src/lib/resolveAuth";
import * as authFns from "../../examples/todo/src/functions/auth";
import * as projectFns from "../../examples/todo/src/functions/projects";
import * as tableFns from "../../examples/todo/src/functions/tables";
import * as customFns from "../../examples/todo/src/functions/projectFns";

let runtime: FlexRuntime | null = null;

function createDb() {
  const onVercel = process.env.VERCEL === "1";

  if (onVercel) {
    const jsonPath =
      process.env.FLEX_DB_PATH ?? join("/tmp", "flex-store.json");
    mkdirSync(dirname(jsonPath), { recursive: true });
    return createJsonDatabase(jsonPath, schema);
  }

  const dbPath =
    process.env.FLEX_DB_PATH ?? join(process.cwd(), "data", "flex.db");
  try {
    return createDatabase(dbPath, schema);
  } catch (err) {
    console.error("SQLite unavailable, using JSON store:", err);
    const jsonPath = join(dirname(dbPath), "flex-store.json");
    return createJsonDatabase(jsonPath, schema);
  }
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
