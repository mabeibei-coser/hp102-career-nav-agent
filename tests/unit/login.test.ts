import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { randomUUID, createHash } from "crypto";
import { resetDbForTests, getDb } from "@/lib/db/client";
import {
  insertSmsCode,
  verifySmsCode,
} from "@/lib/db/repositories/sms-codes";

describe("login verification", () => {
  let tmpDir: string;
  let originalDbPath: string | undefined;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `hp102-login-${randomUUID().slice(0, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
    originalDbPath = process.env.DB_PATH;
    process.env.DB_PATH = join(tmpDir, "test.db");
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.RESUME_DIR = join(tmpDir, "resumes");
    process.env.BANANAROUTER_API_KEY = "test";
    process.env.BANANAROUTER_BASE_URL = "https://api.bananarouter.com";
    process.env.BANANAROUTER_MODEL = "gemini-3.1-flash-lite";
    process.env.E2E_MOCK_MODE = "true";
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = originalDbPath;
    }
  });

  it("correct code verifies", () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO users (id, created_at, last_seen_at) VALUES (?, ?, ?)",
    ).run("u1", Date.now(), Date.now());

    insertSmsCode("13800138000", "123456", 300);
    const result = verifySmsCode("13800138000", "123456");
    expect(result.valid).toBe(true);
  });

  it("wrong code 5 times invalidates entry", () => {
    insertSmsCode("13800138000", "123456", 300);

    for (let i = 0; i < 5; i++) {
      const r = verifySmsCode("13800138000", "000000");
      expect(r.valid).toBe(false);
    }
    const final = verifySmsCode("13800138000", "123456");
    expect(final.valid).toBe(false);
    expect(final.reason).toContain("已失效");
  });

  it("expired code fails", () => {
    const db = getDb();
    const hash = createHash("sha256").update("123456").digest("hex");
    const expired = Math.floor(Date.now() / 1000) - 10;
    db.prepare(
      "INSERT INTO sms_codes (phone, code_hash, expires_at) VALUES (?, ?, ?)",
    ).run("13800138000", hash, expired);

    const result = verifySmsCode("13800138000", "123456");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("过期");
  });
});
