import type Database from "better-sqlite3";
import { readdirSync, readFileSync } from "fs";
import path from "path";

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const migrationsDir = path.join(process.cwd(), "lib/db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = Number.parseInt(file.split("_")[0] ?? "", 10);
    if (!Number.isFinite(version)) continue;

    const applied = db
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(version);
    if (applied) continue;

    const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(version, Date.now());
    })();
  }
}
