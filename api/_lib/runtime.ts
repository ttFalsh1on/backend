import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createDatabase, createRuntime, type FlexRuntime } from "@flex/core";
import { schema } from "../../examples/todo/src/schema.js";
import { resolveAuth } from "../../examples/todo/src/lib/resolveAuth.js";
import * as authFns from "../../examples/todo/src/functions/auth.js";
import * as projectFns from "../../examples/todo/src/functions/projects.js";
import * as todoFns from "../../examples/todo/src/functions/todos.js";

let runtime: FlexRuntime | null = null;

export function getRuntime(): FlexRuntime {
  if (!runtime) {
    const dbPath =
      process.env.FLEX_DB_PATH ?? join("/tmp", "flex-vercel.db");
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = createDatabase(dbPath, schema);
    runtime = createRuntime(db, {
      schema,
      auth: (opts) => resolveAuth(db, opts),
    });
    runtime.registerModule("auth", authFns);
    runtime.registerModule("projects", projectFns);
    runtime.registerModule("todos", todoFns);
  }
  return runtime;
}
