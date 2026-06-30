import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
let cwd = process.cwd();
let messageArgs = args;

if (args.length >= 2) {
  const maybePath = resolve(args[0]);
  try {
    if (existsSync(maybePath) && statSync(maybePath).isDirectory()) {
      cwd = maybePath;
      messageArgs = args.slice(1);
    }
  } catch {
    /* not a path — whole args string is the commit message */
  }
}

const message = messageArgs.join(" ").trim();
if (!message) {
  console.error("Укажите сообщение коммита:");
  console.error('  npm run ship -- "что изменили"');
  console.error('  npm run ship -- "e:\\бэкенд" "что изменили"');
  process.exit(1);
}

const status = execSync("git status --porcelain", { encoding: "utf8", cwd }).trim();
if (!status) {
  console.log(`Нечего коммитить в ${cwd} — все изменения уже в git.`);
  console.log("Если ждёте деплой на Vercel — push уже был, проверьте dashboard.");
  process.exit(0);
}

console.log(`Проект: ${cwd}`);
console.log("Изменённые файлы:");
console.log(status);
console.log("");

execSync("git add -A", { stdio: "inherit", cwd });
execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: "inherit", cwd });
execSync("git push origin main", { stdio: "inherit", cwd });

console.log("");
console.log("Готово: commit + push на GitHub. Vercel подхватит деплой сам.");
