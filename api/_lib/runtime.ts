import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createDatabase, createRuntime, type FlexRuntime } from "@flex/core";
import { schema } from "../../examples/todo/src/schema";
import { resolveAuth } from "../../examples/todo/src/lib/resolveAuth";
import * as authFns from "../../examples/todo/src/functions/auth";
import * as projectFns from "../../examples/todo/src/functions/projects";
import * as todoFns from "../../examples/todo/src/functions/todos";

let runtime: FlexRuntime | null = null;
let initError: Error | null = null;

export function getRuntime(): FlexRuntime {
  if (initError) throw initError;
  if (runtime) return runtime;

  try {
    const dbPath =
      process.env.FLEX_DB_PATH ?? join("/tmp", "flex-vercel.db");
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = createDatabase(dbPath, schema);
    const rt = createRuntime(db, {
      schema,
      auth: (opts) => resolveAuth(db, opts),
    });
    rt.registerModule("auth", authFns);
    rt.registerModule("projects", projectFns);
    rt.registerModule("todos", todoFns);
    runtime = rt;
    return runtime;
  } catch (err) {
    initError =
      err instanceof Error
        ? err
        : new Error("Не удалось инициализировать базу данных");
    console.error("Flex runtime init failed:", initError);
    throw new Error(
      "API недоступен: база данных не запустилась на сервере. " +
        "Для продакшена используйте локальный сервер или Railway."
    );
  }
}
