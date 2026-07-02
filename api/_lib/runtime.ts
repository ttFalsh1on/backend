import { createRuntime, type FlexRuntime } from "@flex/core";
import { schema } from "./todo/schema.js";
import { resolveAuth } from "./todo/lib/resolveAuth.js";
import { executeDynamic } from "./todo/lib/dynamicEngine.js";
import * as authFns from "./todo/functions/auth.js";
import * as projectFns from "./todo/functions/projects.js";
import * as tableFns from "./todo/functions/tables.js";
import * as customFns from "./todo/functions/projectFns.js";
import * as logFns from "./todo/functions/logs.js";
import * as schemaFns from "./todo/functions/schema.js";
import { createApiDatabase } from "./createDb.js";

let runtime: FlexRuntime | null = null;
let initPromise: Promise<FlexRuntime> | null = null;

async function initRuntime(): Promise<FlexRuntime> {
  const db = await createApiDatabase(schema);
  const rt = createRuntime(db, {
    schema,
    auth: (opts) => resolveAuth(db, opts),
    onUnknownFunction: (path, args, options, rt) =>
      executeDynamic(rt, path, args, options),
  });
  rt.registerModule("auth", authFns);
  rt.registerModule("projects", projectFns);
  rt.registerModule("tables", tableFns);
  rt.registerModule("projectFns", customFns);
  rt.registerModule("logs", logFns);
  rt.registerModule("schema", schemaFns);
  return rt;
}

export async function getRuntime(): Promise<FlexRuntime> {
  if (runtime) return runtime;
  if (!initPromise) {
    initPromise = initRuntime().then((rt) => {
      runtime = rt;
      return rt;
    });
  }
  return initPromise;
}
