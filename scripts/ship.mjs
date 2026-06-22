import { execSync } from "node:child_process";

const message = process.argv.slice(2).join(" ").trim();
if (!message) {
  console.error("Укажите сообщение коммита:");
  console.error('  npm run ship -- "что изменили"');
  process.exit(1);
}

const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (!status) {
  console.log("Нечего коммитить — все изменения уже в git.");
  console.log("Если ждёте деплой на Vercel — push уже был, проверьте dashboard.");
  process.exit(0);
}

console.log("Изменённые файлы:");
console.log(status);
console.log("");

execSync("git add -A", { stdio: "inherit" });
execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: "inherit" });
execSync("git push origin main", { stdio: "inherit" });

console.log("");
console.log("Готово: commit + push на GitHub. Vercel подхватит деплой сам.");
