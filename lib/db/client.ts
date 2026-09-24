import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";
import { runMigrations } from "./migrate";

let dbInstance: Database.Database | null = null;

function createDb(): Database.Database {
  const dbPath = process.env.DB_PATH ?? "./data/hp102.db";
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = createDb();
  }
  return dbInstance;
}

export function withTransaction<T>(fn: () => T): T {
  const db = getDb();
  return db.transaction(fn)();
}

export function resetDbForTests(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
