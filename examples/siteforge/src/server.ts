import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase, createRuntime } from "@flex/core";
import { createFlexServer } from "@flex/server";
import { schema } from "./schema.js";
import { resolveAuth } from "./lib/resolveAuth.js";
import * as authFns from "./functions/auth.js";
import * as profileFns from "./functions/profiles.js";
import * as serviceFns from "./functions/services.js";
import * as reviewFns from "./functions/reviews.js";
import * as cmsFns from "./functions/cms.js";
import * as themeFns from "./functions/theme.js";
import * as navFns from "./functions/navItems.js";
import * as adminFns from "./functions/admins.js";
import * as seedFns from "./functions/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "flex.db");

const db = createDatabase(dbPath, schema);
const runtime = createRuntime(db, {
  schema,
  auth: (opts) => resolveAuth(db, opts),
});

runtime.registerModule("auth", authFns);
runtime.registerModule("profiles", profileFns);
runtime.registerModule("services", serviceFns);
runtime.registerModule("reviews", reviewFns);
runtime.registerModule("cms", cmsFns);
runtime.registerModule("theme", themeFns);
runtime.registerModule("navItems", navFns);
runtime.registerModule("admins", adminFns);
runtime.registerModule("seed", seedFns);

const server = createFlexServer({ runtime, port: 3210 });

const { url } = await server.start();
console.log(`SiteForge Flex API running at ${url}`);
console.log(`  POST ${url}/api/run`);
console.log(`  GET  ${url}/api/health`);

try {
  const result = await runtime.execute("seed:seedIfEmpty", {}, {});
  if ((result.value as { seeded?: boolean }).seeded) {
    console.log("  Seed: начальные данные загружены");
  }
} catch (err) {
  console.warn("  Seed skipped:", err);
}
