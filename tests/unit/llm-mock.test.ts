import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { chatWithTools } from "@/lib/llm/chat";
import { generateJson } from "@/lib/llm/generate-json";
import { MockChatAdapter } from "@/lib/llm/mock";

describe("llm mock", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.E2E_MOCK_MODE = "true";
    process.env.DB_PATH = ":memory:";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns mock json without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const interview = await generateJson<{ questions: Array<{ id: string }> }>({
      purpose: "interview_questions",
      system: "json",
      user: "json",
      maxOutputTokens: 128,
      temperature: 0.2,
      timeoutMs: 1000,
    });
    expect(interview.data.questions).toHaveLength(2);
    expect(interview.provider).toBe("mock");

    const hints = await generateJson<{
      education: string;
      workYears: string;
      targetPosition: string;
    }>({
      purpose: "resume_hints",
      system: "json",
      user: "json",
      maxOutputTokens: 128,
      temperature: 0.2,
      timeoutMs: 1000,
    });
    expect(hints.data).toEqual({
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "行政专员",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("mock chat handles quiz and profile tools", async () => {
    const adapter = new MockChatAdapter();
    const recordQuiz = {
      name: "record_quiz_answer",
      description: "记录测评答案",
      parameters: {
        type: "object" as const,
        properties: {
          questionId: { type: "string" as const },
          optionLabel: { type: "string" as const },
        },
      },
    };

    const withTools = await adapter.chat({
      system: "- 当前题：SJT-04「示例题」",
      history: [{ role: "user", text: "选B" }],
      turnState: null,
      tools: [recordQuiz],
      allowTools: true,
      timeoutMs: 1000,
    });
    expect(withTools.toolCalls[0]).toEqual({
      name: "record_quiz_answer",
      args: { questionId: "SJT-04", optionLabel: "B" },
    });

    const withoutTools = await adapter.chat({
      system: "- 当前题：SJT-04「示例题」",
      history: [{ role: "user", text: "选B" }],
      turnState: null,
      tools: [recordQuiz],
      allowTools: false,
      timeoutMs: 1000,
    });
    expect(withoutTools.toolCalls).toEqual([]);
    expect(withoutTools.text).toBe("这是模拟回复。");
  });

  it("mock chat handles tool results and profile parsing", async () => {
    const adapter = new MockChatAdapter();
    const proposeProfile = {
      name: "propose_profile",
      description: "提议档案",
      parameters: { type: "object" as const, properties: {} },
    };

    const afterTools = await adapter.chat({
      system: "sys",
      history: [{ role: "user", text: "继续" }],
      turnState: null,
      toolResults: [
        {
          call: { name: "show_current_step", args: {} },
          response: { ok: true },
        },
      ],
      tools: [],
      allowTools: true,
      timeoutMs: 1000,
    });
    expect(afterTools.text).toBe("好的，我们继续。（模拟回复）");
    expect(afterTools.toolCalls).toEqual([]);

    const profile = await adapter.chat({
      system: "sys",
      history: [
        {
          role: "user",
          text: "档案：identity=recent_grad；education=bachelor",
        },
      ],
      turnState: null,
      tools: [proposeProfile],
      allowTools: true,
      timeoutMs: 1000,
    });
    expect(profile.toolCalls[0]).toEqual({
      name: "propose_profile",
      args: { identity: "recent_grad", education: "bachelor" },
    });

    const plain = await adapter.chat({
      system: "sys",
      history: [{ role: "user", text: "你好" }],
      turnState: null,
      tools: [],
      allowTools: true,
      timeoutMs: 1000,
    });
    expect(plain.text).toBe("这是模拟回复。");
  });

  it("chatWithTools uses mock adapter by default in mock mode", async () => {
    const result = await chatWithTools({
      system: "sys",
      history: [{ role: "user", text: "你好" }],
      turnState: null,
      tools: [],
      allowTools: true,
      conversationId: "conv-mock",
      step: 1,
    });
    expect(result.text).toBe("这是模拟回复。");
  });
});
