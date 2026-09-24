import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbForTests } from "@/lib/db/client";

let tmpDir = "";

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "hp102-instrumentation-"));
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("DB_PATH", path.join(tmpDir, "test.db"));
  vi.stubEnv("RESUME_DIR", path.join(tmpDir, "resumes"));
  vi.stubEnv("SESSION_SECRET", "test-session-secret-32chars-minimum");
  vi.resetModules();
});

afterEach(() => {
  resetDbForTests();
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Windows may keep the sqlite file locked briefly after close.
  }
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("instrumentation", () => {
  it("throws when E2E_MOCK_MODE is enabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_MOCK_MODE", "true");
    const { register } = await import("@/instrumentation");
    await expect(register()).rejects.toThrow(
      "E2E_MOCK_MODE must not be enabled in production",
    );
  });

  it("throws when BANANAROUTER_MODEL is missing outside mock mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_MOCK_MODE", "false");
    vi.stubEnv("BANANAROUTER_API_KEY", "test-key");
    vi.stubEnv("BANANAROUTER_BASE_URL", "https://api.bananarouter.com");
    vi.stubEnv("BANANAROUTER_MODEL", "");
    const { register } = await import("@/instrumentation");
    await expect(register()).rejects.toThrow(/BANANAROUTER_MODEL/);
  });

  it("does not throw when all BananaRouter vars are set outside mock mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_MOCK_MODE", "false");
    vi.stubEnv("BANANAROUTER_API_KEY", "test-key");
    vi.stubEnv("BANANAROUTER_BASE_URL", "https://api.bananarouter.com");
    vi.stubEnv("BANANAROUTER_MODEL", "gemini-3.1-flash-lite");
    const { register } = await import("@/instrumentation");
    await expect(register()).resolves.toBeUndefined();
  });
});
