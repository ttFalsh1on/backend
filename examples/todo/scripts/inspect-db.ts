import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "flex.db");

const db = new Database(dbPath, { readonly: true });

function listTable(table: string, label: string) {
  const rows = db
    .prepare(
      `SELECT doc_id, data, creation_time FROM _documents
       WHERE table_name = ? ORDER BY creation_time DESC`
    )
    .all(table) as { doc_id: string; data: string; creation_time: number }[];

  console.log(`\n=== ${label} (${rows.length}) ===`);
  for (const row of rows) {
    const doc = JSON.parse(row.data) as Record<string, unknown>;
    console.log(JSON.stringify({ id: row.doc_id, ...doc }, null, 0));
  }
}

listTable("users", "Пользователи");
listTable("projects", "Проекты");
listTable("projectMembers", "Участники");
listTable("todos", "Задачи");
listTable("sessions", "Сессии");

db.close();
