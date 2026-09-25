import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { resetDbForTests } from "@/lib/db/client";
import { insertSmsCode, getLastCode } from "@/lib/db/repositories/sms-codes";
import { sendSms, validatePhone } from "@/lib/sms/smsbao";

describe("sms", () => {
  let tmpDir: string;
  let originalDbPath: string | undefined;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `hp102-sms-${randomUUID().slice(0, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
    originalDbPath = process.env.DB_PATH;
    process.env.DB_PATH = join(tmpDir, "test.db");
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.RESUME_DIR = join(tmpDir, "resumes");
    process.env.BANANAROUTER_API_KEY = "test";
    process.env.BANANAROUTER_BASE_URL = "https://api.bananarouter.com";
    process.env.BANANAROUTER_MODEL = "gemini-3.1-flash-lite";
    process.env.E2E_MOCK_MODE = "true";
    process.env.SMSBAO_USER = "testuser";
    process.env.SMSBAO_PASS = "testpass";
    process.env.SMSBAO_SIGN = "测试";
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

  it("smsbao sends and returns ok when API returns 0", async () => {
    process.env.E2E_MOCK_MODE = "";
    const fakeFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve("0"),
    });
    await expect(
      sendSms("13800138000", "123456", fakeFetch as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    expect(fakeFetch).toHaveBeenCalledOnce();
  });

  it("smsbao throws SMS_FAILED when API returns 30", async () => {
    process.env.E2E_MOCK_MODE = "";
    const fakeFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve("30"),
    });
    await expect(
      sendSms("13800138000", "123456", fakeFetch as unknown as typeof fetch),
    ).rejects.toThrow("短信发送失败");
  });

  it("validates phone format", () => {
    expect(() => validatePhone("13800138000")).not.toThrow();
    expect(() => validatePhone("1234")).toThrow("手机号格式不正确");
  });

  it("sms_codes stores hash not plaintext", () => {
    insertSmsCode("13800138000", "654321", 300);
    const entry = getLastCode("13800138000");
    expect(entry).not.toBeNull();
    expect(entry!.codeHash).not.toBe("654321");
    expect(entry!.codeHash.length).toBe(64);
  });
});
