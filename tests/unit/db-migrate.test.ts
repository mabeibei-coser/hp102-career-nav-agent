import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, withTransaction } from "@/lib/db/client";
import { createUser } from "@/lib/db/repositories/users";

describe("db migrate", () => {
  let tempDir: string;
  let dbPath: string;
  const originalDbPath = process.env.DB_PATH;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hp102-db-"));
    dbPath = join(tempDir, "test.db");
    process.env.DB_PATH = dbPath;
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = originalDbPath;
    }
  });

  it("creates all expected tables with llm_calls columns", () => {
    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual([
      "career_tasks",
      "conversations",
      "interview_answers",
      "llm_calls",
      "messages",
      "profiles",
      "quiz_answers",
      "report_jobs",
      "reports",
      "resume_files",
      "schema_migrations",
      "sms_codes",
      "users",
    ]);

    const columns = db
      .prepare("PRAGMA table_info(llm_calls)")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(columns).toContain("kind");
    expect(columns).toContain("step");
    expect(columns).toContain("error_category");
    expect(columns).toContain("finish_reason");
  });

  it("resetDbForTests reopens the same database without rerunning migrations", () => {
    getDb();
    resetDbForTests();
    const db = getDb();
    const migrations = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all();
    expect(migrations).toEqual([{ version: 1 }, { version: 2 }]);
  });

  it("enables WAL and foreign keys and rolls back failed transactions", () => {
    const db = getDb();
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);

    expect(() =>
      withTransaction(() => {
        createUser();
        throw new Error("rollback");
      }),
    ).toThrow("rollback");

    const count = db
      .prepare("SELECT COUNT(*) AS count FROM users")
      .get() as { count: number };
    expect(count.count).toBe(0);
  });
});
