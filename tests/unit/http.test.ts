import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import { toErrorResponse } from "@/lib/http";
import { apiUrl } from "@/lib/api-base";

describe("http", () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
    vi.resetModules();
  });

  it("maps DomainError codes to HTTP status and default messages", () => {
    const busy = toErrorResponse(new DomainError("BUSY"));
    expect(busy.status).toBe(409);
    expect(busy.body).toEqual({
      error: { code: "BUSY", message: "上一条还在处理中，请稍等" },
    });

    const llm = toErrorResponse(new DomainError("LLM_UNAVAILABLE"));
    expect(llm.status).toBe(503);
  });

  it("uses custom message for DomainError and hides unknown errors", () => {
    const custom = toErrorResponse(new DomainError("INVALID_INPUT", "文字太长"));
    expect(custom.status).toBe(400);
    expect(custom.body.error.message).toBe("文字太长");

    const internal = toErrorResponse(new Error("x"));
    expect(internal.status).toBe(500);
    expect(internal.body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(internal.body)).not.toContain("x");
  });

  it("builds apiUrl with optional base path", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/hp102";
    vi.resetModules();
    const { apiUrl: apiUrlWithBase } = await import("@/lib/api-base");
    expect(apiUrlWithBase("/api/chat")).toBe("/hp102/api/chat");

    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.resetModules();
    const { apiUrl: apiUrlWithoutBase } = await import("@/lib/api-base");
    expect(apiUrlWithoutBase("/api/chat")).toBe("/api/chat");
  });

  it("apiUrl reads env at call time", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(apiUrl("/api/chat")).toBe("/api/chat");

    process.env.NEXT_PUBLIC_BASE_PATH = "/hp102";
    expect(apiUrl("/api/chat")).toBe("/hp102/api/chat");
  });
});
