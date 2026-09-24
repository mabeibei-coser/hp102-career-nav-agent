import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createGeminiChatAdapter } from "@/lib/llm/gemini-chat";
import { LlmError } from "@/lib/llm/types";

const configEnv = {
  BANANAROUTER_API_KEY: "test-key",
  BANANAROUTER_BASE_URL: "https://api.bananarouter.com",
  BANANAROUTER_MODEL: "gemini-3.1-flash-lite",
};

const showCurrentStep = {
  name: "show_current_step",
  description: "显示当前步骤",
  parameters: { type: "object" as const, properties: {} },
};

describe("gemini chat", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, configEnv);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("maps history and tools on first call", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const adapter = createGeminiChatAdapter({
      fetchImpl: async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body));
        return Response.json({
          candidates: [
            {
              content: { role: "model", parts: [{ text: "ok" }] },
              finishReason: "STOP",
            },
          ],
        });
      },
    });

    await adapter.chat({
      system: "sys",
      history: [
        { role: "assistant", text: "你好，我是助手" },
        { role: "user", text: "继续" },
      ],
      turnState: null,
      tools: [showCurrentStep],
      allowTools: true,
      timeoutMs: 1000,
    });

    expect(capturedBody?.contents).toEqual([
      { role: "model", parts: [{ text: "你好，我是助手" }] },
      { role: "user", parts: [{ text: "继续" }] },
    ]);
    const tools = capturedBody?.tools as Array<{
      functionDeclarations: Array<{ name: string }>;
    }>;
    expect(tools?.[0]?.functionDeclarations?.[0]?.name).toBe(
      "show_current_step",
    );
    const toolConfig = capturedBody?.toolConfig as {
      functionCallingConfig: { mode: string };
    };
    expect(toolConfig.functionCallingConfig.mode).toBe("AUTO");
    const generationConfig = capturedBody?.generationConfig as {
      thinkingConfig: { thinkingLevel: string };
      temperature?: number;
    };
    expect(generationConfig.thinkingConfig.thinkingLevel).toBe("minimal");
    expect(generationConfig.temperature).toBeUndefined();
  });

  it("preserves thoughtSignature and batches function responses", async () => {
    const modelContent = {
      role: "model",
      parts: [
        {
          functionCall: {
            name: "record_quiz_answer",
            args: { questionId: "SJT-01", optionLabel: "A" },
            id: "c1",
          },
          thoughtSignature: "SIG",
        },
        {
          functionCall: { name: "show_current_step", args: {} },
        },
      ],
    };

    let firstBody: Record<string, unknown> | undefined;
    let secondBody: Record<string, unknown> | undefined;
    let callCount = 0;

    const adapter = createGeminiChatAdapter({
      fetchImpl: async (_input, init) => {
        callCount += 1;
        const body = JSON.parse(String(init?.body));
        if (callCount === 1) firstBody = body;
        else secondBody = body;
        return Response.json({
          candidates: [
            {
              content: modelContent,
              finishReason: "STOP",
            },
          ],
        });
      },
    });

    const first = await adapter.chat({
      system: "sys",
      history: [{ role: "user", text: "继续" }],
      turnState: null,
      tools: [showCurrentStep],
      allowTools: true,
      timeoutMs: 1000,
    });

    expect(first.toolCalls).toHaveLength(2);
    expect(first.toolCalls[0].id).toBe("c1");

    await adapter.chat({
      system: "sys",
      history: [{ role: "user", text: "继续" }],
      turnState: first.turnState,
      toolResults: [
        {
          call: first.toolCalls[0],
          response: { ok: true },
        },
        {
          call: first.toolCalls[1],
          response: { skipped: true, reason: "一次只执行一个操作" },
        },
      ],
      tools: [showCurrentStep],
      allowTools: true,
      timeoutMs: 1000,
    });

    const contents = secondBody?.contents as Array<Record<string, unknown>>;
    expect(contents?.[contents.length - 2]).toEqual(modelContent);
    const last = contents?.[contents.length - 1] as {
      role: string;
      parts: Array<Record<string, unknown>>;
    };
    expect(last.role).toBe("user");
    expect(last.parts).toHaveLength(2);
    expect(last.parts[0]).toEqual({
      functionResponse: {
        name: "record_quiz_answer",
        id: "c1",
        response: { ok: true },
      },
    });
    expect(last.parts[1]).toEqual({
      functionResponse: {
        name: "show_current_step",
        response: { skipped: true, reason: "一次只执行一个操作" },
      },
    });
    expect(firstBody).toBeDefined();
  });

  it("handles blocked, max tokens, and invalid responses", async () => {
    const adapter = createGeminiChatAdapter({
      fetchImpl: async () =>
        Response.json({
          candidates: [
            {
              content: { role: "model", parts: [{ text: "部分" }] },
              finishReason: "MAX_TOKENS",
            },
          ],
        }),
    });

    const maxTokens = await adapter.chat({
      system: "sys",
      history: [{ role: "user", text: "继续" }],
      turnState: null,
      tools: [showCurrentStep],
      allowTools: true,
      timeoutMs: 1000,
    });
    expect(maxTokens.text).toBe("部分");
    expect(maxTokens.finish).toBe("max_tokens");

    const blockedAdapter = createGeminiChatAdapter({
      fetchImpl: async () =>
        Response.json({
          candidates: [
            {
              content: { role: "model", parts: [{ text: "hidden" }] },
              finishReason: "SAFETY",
            },
          ],
        }),
    });
    const blocked = await blockedAdapter.chat({
      system: "sys",
      history: [{ role: "user", text: "继续" }],
      turnState: null,
      tools: [showCurrentStep],
      allowTools: false,
      timeoutMs: 1000,
    });
    expect(blocked.finish).toBe("blocked");
    expect(blocked.text).toBe("");
    expect(blocked.toolCalls).toEqual([]);

    let capturedBody: Record<string, unknown> | undefined;
    const noneAdapter = createGeminiChatAdapter({
      fetchImpl: async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body));
        return Response.json({
          candidates: [
            {
              content: { role: "model", parts: [{ text: "ok" }] },
              finishReason: "STOP",
            },
          ],
        });
      },
    });
    await noneAdapter.chat({
      system: "sys",
      history: [{ role: "user", text: "继续" }],
      turnState: null,
      tools: [showCurrentStep],
      allowTools: false,
      timeoutMs: 1000,
    });
    const toolConfig = capturedBody?.toolConfig as {
      functionCallingConfig: { mode: string };
    };
    expect(toolConfig.functionCallingConfig.mode).toBe("NONE");

    const emptyAdapter = createGeminiChatAdapter({
      fetchImpl: async () => Response.json({ candidates: [] }),
    });
    await expect(
      emptyAdapter.chat({
        system: "sys",
        history: [{ role: "user", text: "继续" }],
        turnState: null,
        tools: [showCurrentStep],
        allowTools: true,
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ category: "invalid_response" });

    const malformedAdapter = createGeminiChatAdapter({
      fetchImpl: async () =>
        Response.json({
          candidates: [
            {
              content: { role: "model", parts: [] },
              finishReason: "MALFORMED_FUNCTION_CALL",
            },
          ],
        }),
    });
    await expect(
      malformedAdapter.chat({
        system: "sys",
        history: [{ role: "user", text: "继续" }],
        turnState: null,
        tools: [showCurrentStep],
        allowTools: true,
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(LlmError);
  });
});
