import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sealData } from "iron-session";

const TEST_SECRET = "0123456789abcdef0123456789abcdef";
const COOKIE_NAME = "hp102_session";

function createCookieStore() {
  const store = new Map<string, string>();
  return {
    get: (name: string) => {
      const value = store.get(name);
      return value ? { name, value } : undefined;
    },
    set: (nameOrOpts: string | { name: string; value: string }, value?: string) => {
      if (typeof nameOrOpts === "string") {
        store.set(nameOrOpts, value!);
      } else {
        store.set(nameOrOpts.name, nameOrOpts.value);
      }
    },
    has: (name: string) => store.has(name),
    getValue: (name: string) => store.get(name),
  };
}

let cookieStore = createCookieStore();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

describe("session", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    cookieStore = createCookieStore();
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.DB_PATH = ":memory:";
    vi.resetModules();
    const { resetDbForTests } = await import("@/lib/db/client");
    resetDbForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("creates a user and sets hp102_session cookie when no cookie exists", async () => {
    const { getOrCreateUser } = await import("@/lib/session");
    const { countUsers } = await import("@/lib/db/repositories/users");

    const userId = await getOrCreateUser();

    expect(userId).toBeTruthy();
    expect(countUsers()).toBe(1);
    expect(cookieStore.has(COOKIE_NAME)).toBe(true);
  });

  it("returns the same userId on subsequent calls", async () => {
    const { getOrCreateUser } = await import("@/lib/session");
    const { countUsers } = await import("@/lib/db/repositories/users");

    const first = await getOrCreateUser();
    const second = await getOrCreateUser();

    expect(second).toBe(first);
    expect(countUsers()).toBe(1);
  });

  it("throws when SESSION_SECRET is too short", async () => {
    process.env.SESSION_SECRET = "short";
    vi.resetModules();

    const { getOrCreateUser } = await import("@/lib/session");
    await expect(getOrCreateUser()).rejects.toThrow(
      "SESSION_SECRET must be at least 32 characters",
    );
  });

  it("creates a new user when session userId does not exist in db", async () => {
    const staleUserId = "00000000-0000-4000-8000-000000000001";
    const sealed = await sealData(
      { userId: staleUserId },
      { password: TEST_SECRET },
    );
    cookieStore.set(COOKIE_NAME, sealed);

    const { getOrCreateUser } = await import("@/lib/session");
    const { countUsers } = await import("@/lib/db/repositories/users");

    const userId = await getOrCreateUser();

    expect(userId).not.toBe(staleUserId);
    expect(countUsers()).toBe(1);
  });
});
