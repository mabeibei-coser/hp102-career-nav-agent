import { describe, it, expect } from "vitest";
import { getBananaRouterConfig, isMockMode } from "@/lib/llm/config";
import {
  extractJson,
  stripReasoning,
  tryFixAndParse,
} from "@/lib/llm/json-utils";
import { LlmError } from "@/lib/llm/types";

describe("llm basics", () => {
  it("parses json helpers", () => {
    expect(
      extractJson('好的，结果如下：\n```json\n{"a":1}\n```'),
    ).toBe('{"a":1}');
    expect(
      stripReasoning('<think>略</think>{"a":1}'),
    ).toBe('{"a":1}');
    expect(tryFixAndParse('{"a":1,"b":{"c":2')).toEqual({
      a: 1,
      b: { c: 2 },
    });
    expect(tryFixAndParse("{“a”：1，“b”：2}")).toEqual({ a: 1, b: 2 });
  });

  it("reads BananaRouter config", () => {
    expect(
      getBananaRouterConfig({
        BANANAROUTER_API_KEY: " test-key ",
        BANANAROUTER_BASE_URL: "https://api.bananarouter.com/",
        BANANAROUTER_MODEL: "gemini-3.1-flash-lite",
      }),
    ).toEqual({
      apiKey: "test-key",
      baseURL: "https://api.bananarouter.com",
      model: "gemini-3.1-flash-lite",
    });
  });

  it("throws not_configured without leaking values", () => {
    const cases = [
      {
        env: {
          BANANAROUTER_BASE_URL: "https://api.bananarouter.com",
          BANANAROUTER_MODEL: "gemini-3.1-flash-lite",
        },
        missing: "BANANAROUTER_API_KEY",
      },
      {
        env: {
          BANANAROUTER_API_KEY: "test-key",
          BANANAROUTER_MODEL: "gemini-3.1-flash-lite",
        },
        missing: "BANANAROUTER_BASE_URL",
      },
      {
        env: {
          BANANAROUTER_API_KEY: "test-key",
          BANANAROUTER_BASE_URL: "https://api.bananarouter.com",
        },
        missing: "BANANAROUTER_MODEL",
      },
      {
        env: {
          BANANAROUTER_API_KEY: "test-key",
          BANANAROUTER_BASE_URL: "https://api.bananarouter.com",
          BANANAROUTER_MODEL: "   ",
        },
        missing: "BANANAROUTER_MODEL",
      },
    ];

    for (const { env, missing } of cases) {
      try {
        getBananaRouterConfig(env);
        throw new Error("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(LlmError);
        expect((error as LlmError).category).toBe("not_configured");
        expect((error as LlmError).message).toContain(missing);
        expect((error as LlmError).message).not.toContain("test-key");
      }
    }
  });

  it("detects mock mode", () => {
    const original = process.env.E2E_MOCK_MODE;
    process.env.E2E_MOCK_MODE = "true";
    expect(isMockMode()).toBe(true);
    process.env.E2E_MOCK_MODE = "false";
    expect(isMockMode()).toBe(false);
    if (original === undefined) {
      delete process.env.E2E_MOCK_MODE;
    } else {
      process.env.E2E_MOCK_MODE = original;
    }
  });
});
