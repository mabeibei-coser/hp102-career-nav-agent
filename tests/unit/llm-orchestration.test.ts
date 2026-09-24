import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import { listLlmCalls } from "@/lib/db/repositories/llm-calls";
import { chatWithTools } from "@/lib/llm/chat";
import { generateJson } from "@/lib/llm/generate-json";
import { createLimiter } from "@/lib/llm/limiter";
import { LlmError, type ChatAdapter, type JsonProvider } from "@/lib/llm/types";

const configEnv = {
  DB_PATH: ":memory:",
  BANANAROUTER_API_KEY: "KEY_MARKER_456",
  BANANAROUTER_BASE_URL: "https://api.bananarouter.com",
  BANANAROUTER_MODEL: "gemini-3.1-flash-lite",
  E2E_MOCK_MODE: "false",
};

function fakeProvider(
  impl: JsonProvider["completeJsonText"],
): JsonProvider {
  return {
    provider: "bananarouter",
    model: "gemini-3.1-flash-lite",
    completeJsonText: impl,
  };
}

describe("llm orchestration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetDbForTests();
    Object.assign(process.env, configEnv);
  });

  afterEach(() => {
    resetDbForTests();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("generates json and logs success", async () => {
    const provider = fakeProvider(async () => ({
      text: '```json\n{"x":1}\n```',
      finishReason: "STOP",
    }));

    const result = await generateJson<{ x: number }>({
      purpose: "smoke",
      system: "return json",
      user: "please json",
      maxOutputTokens: 128,
      temperature: 0.2,
      timeoutMs: 1000,
      provider,
      retryDelayMs: 0,
    });

    expect(result).toEqual({
      data: { x: 1 },
      provider: "bananarouter",
      model: "gemini-3.1-flash-lite",
    });
    const rows = listLlmCalls();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("json");
    expect(rows[0].step).toBe(1);
    expect(rows[0].ok).toBe(1);
  });

  it("rejects prompts without json literal", async () => {
    const provider = fakeProvider(async () => ({
      text: '{"x":1}',
      finishReason: "STOP",
    }));

    await expect(
      generateJson({
        purpose: "smoke",
        system: "plain",
        user: "plain",
        maxOutputTokens: 128,
        temperature: 0.2,
        timeoutMs: 1000,
        provider,
      }),
    ).rejects.toThrow(/json/i);
    expect(listLlmCalls()).toHaveLength(0);
  });

  it("applies retry rules", async () => {
    let calls = 0;
    const retryProvider = fakeProvider(async () => {
      calls += 1;
      if (calls === 1) {
        throw new LlmError("provider_error", "upstream");
      }
      return { text: '{"x":1}', finishReason: "STOP" };
    });

    await generateJson({
      purpose: "smoke",
      system: "json",
      user: "json",
      maxOutputTokens: 128,
      temperature: 0.2,
      timeoutMs: 1000,
      provider: retryProvider,
      retryDelayMs: 0,
    });

    const rows = listLlmCalls();
    expect(rows).toHaveLength(2);
    expect(rows[0].error_category).toBe("provider_error");
    expect(rows[0].step).toBe(1);
    expect(rows[1].step).toBe(2);

    calls = 0;
    resetDbForTests();
    const badJsonProvider = fakeProvider(async () => {
      calls += 1;
      if (calls === 1) return { text: "not-json", finishReason: "STOP" };
      return { text: '{"x":1}', finishReason: "STOP" };
    });
    await generateJson({
      purpose: "smoke",
      system: "json",
      user: "json",
      maxOutputTokens: 128,
      temperature: 0.2,
      timeoutMs: 1000,
      provider: badJsonProvider,
      retryDelayMs: 0,
    });
    expect(calls).toBe(2);

    let rateCalls = 0;
    resetDbForTests();
    await expect(
      generateJson({
        purpose: "smoke",
        system: "json",
        user: "json",
        maxOutputTokens: 128,
        temperature: 0.2,
        timeoutMs: 1000,
        provider: fakeProvider(async () => {
          rateCalls += 1;
          throw new LlmError("rate_limited", "busy");
        }),
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({ category: "rate_limited" });
    expect(rateCalls).toBe(1);

    let authCalls = 0;
    resetDbForTests();
    await expect(
      generateJson({
        purpose: "smoke",
        system: "json",
        user: "json",
        maxOutputTokens: 128,
        temperature: 0.2,
        timeoutMs: 1000,
        provider: fakeProvider(async () => {
          authCalls += 1;
          throw new LlmError("unauthorized", "bad key");
        }),
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({ category: "unauthorized" });
    expect(authCalls).toBe(1);

    let validatorCalls = 0;
    resetDbForTests();
    await generateJson({
      purpose: "smoke",
      system: "json",
      user: "json",
      maxOutputTokens: 128,
      temperature: 0.2,
      timeoutMs: 1000,
      provider: fakeProvider(async (input) => {
        validatorCalls += 1;
        if (input.user === "json") return { text: '{"x":0}', finishReason: "STOP" };
        return { text: '{"x":1}', finishReason: "STOP" };
      }),
      validator: (data: { x: number }) =>
        data.x === 1 ? null : "x must be 1",
      onValidationFailure: () => ({ user: "修正 json" }),
      retryDelayMs: 0,
    });
    expect(validatorCalls).toBe(2);

    resetDbForTests();
    await expect(
      generateJson({
        purpose: "smoke",
        system: "json",
        user: "json",
        maxOutputTokens: 128,
        temperature: 0.2,
        timeoutMs: 1000,
        provider: fakeProvider(async () => ({ text: '{"x":0}', finishReason: "STOP" })),
        validator: () => "bad",
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({ category: "validation_failed" });
  });

  it("chatWithTools does not retry and redacts sensitive markers", async () => {
    const logs: string[] = [];
    for (const method of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      });
    }

    let chatCalls = 0;
    const adapter: ChatAdapter = {
      provider: "bananarouter",
      model: "gemini-3.1-flash-lite",
      chat: async (input) => {
        chatCalls += 1;
        expect(input.system).toContain("PROMPT_MARKER_123");
        if (chatCalls === 1) {
          throw new LlmError("timeout", "timeout");
        }
        return {
          text: "REPLY_MARKER_000",
          toolCalls: [],
          finish: "stop",
          finishReason: "STOP",
          turnState: {
            provider: "bananarouter",
            data: { thoughtSignature: "SIG_MARKER_789" },
          },
        };
      },
    };

    await expect(
      chatWithTools({
        system: "PROMPT_MARKER_123",
        history: [{ role: "user", text: "hi" }],
        turnState: null,
        tools: [],
        allowTools: false,
        conversationId: "conv-1",
        step: 1,
        adapter,
      }),
    ).rejects.toMatchObject({ category: "timeout" });
    expect(chatCalls).toBe(1);

    const serialized = JSON.stringify(listLlmCalls());
    for (const marker of [
      "PROMPT_MARKER_123",
      "KEY_MARKER_456",
      "SIG_MARKER_789",
      "REPLY_MARKER_000",
    ]) {
      expect(serialized).not.toContain(marker);
      expect(logs.join("\n")).not.toContain(marker);
    }
    expect(listLlmCalls()[0].error_category).toBe("timeout");
    expect(listLlmCalls()[0].kind).toBe("chat");
  });

  it("createLimiter runs tasks sequentially when max is 1", async () => {
    const limiter = createLimiter(1);
    const order: number[] = [];

    await Promise.all([
      limiter.run(async () => {
        order.push(1);
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push(2);
      }),
      limiter.run(async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });
});
