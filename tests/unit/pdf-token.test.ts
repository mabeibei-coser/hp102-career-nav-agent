import { describe, it, expect, beforeAll } from "vitest";
import { signPdfToken, verifyPdfToken } from "@/lib/pdf-token";

beforeAll(() => {
  process.env.SESSION_SECRET = "unit-test-session-secret-32chars!!";
});

describe("pdf-token", () => {
  it("accepts a fresh token", () => {
    const now = 1_700_000_000_000;
    const token = signPdfToken("uuid-a", now);
    expect(verifyPdfToken("uuid-a", token, now + 30_000)).toBe(true);
  });

  it("rejects expired, wrong uuid, and tampered tokens", () => {
    const now = 1_700_000_000_000;
    const token = signPdfToken("uuid-a", now);
    expect(verifyPdfToken("uuid-a", token, now + 61_000)).toBe(false);
    expect(verifyPdfToken("uuid-b", token, now + 30_000)).toBe(false);
    const tampered =
      token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyPdfToken("uuid-a", tampered, now + 30_000)).toBe(false);
  });
});
