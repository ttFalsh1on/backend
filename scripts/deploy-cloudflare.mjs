import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "examples", "todo", "public");
const cloudflareDir = join(root, "cloudflare");

console.log("1/3 Сборка (Vercel bundle + статика)…");
execSync("npm run build:vercel", { stdio: "inherit", cwd: root });

const configPath = join(publicDir, "config.js");
writeFileSync(
  configPath,
  `// Cloudflare Pages — API на том же домене (прокси)
window.FLEX_CONFIG = {
  apiBase: "",
  httpOnly: true,
  pollIntervalMs: 3000,
  fetchTimeoutMs: 45000,
};
`,
  "utf8"
);
console.log("2/3 config.js для Cloudflare (same-origin API)");

console.log("3/3 Деплой на Cloudflare Pages…");
console.log("   Если не залогинены: npx wrangler login");
try {
  execSync(
    "npx wrangler pages deploy --project-name flex-backend",
    {
      stdio: "inherit",
      cwd: cloudflareDir,
    }
  );
} catch (err) {
  console.error("\nДеплой не удался. Нужен аккаунт Cloudflare и wrangler login.");
  process.exit(1);
}

console.log(`
Готово. Откройте URL из вывода выше (*.pages.dev) — без VPN.
В Cloudflare Dashboard → Workers & Pages → flex-backend → Settings → Environment:
  VERCEL_ORIGIN = ваш рабочий URL Vercel (если сменился после деплоя).
`);
