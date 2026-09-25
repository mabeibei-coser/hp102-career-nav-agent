import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import { createUser } from "@/lib/db/repositories/users";
import { createConversation } from "@/lib/conversation/service";
import { getConversationView } from "@/lib/conversation/view";
import { buildHistory, runChatTurn } from "@/lib/agent/loop";
import { COPY } from "@/lib/career/copy";
import { confirmProfile, ensureActiveTask } from "@/lib/career/service";
import { listMessages, insertMessages } from "@/lib/db/repositories/messages";
import { listQuizAnswers } from "@/lib/db/repositories/quiz-answers";
import { DomainError } from "@/lib/errors";
import {
  LlmError,
  type ChatAdapter,
  type NeutralMessage,
  type NeutralTool,
  type ToolResult,
  type TurnState,
} from "@/lib/llm/types";

let tmpDir = "";

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "hp102-agent-loop-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
  process.env.RESUME_DIR = path.join(tmpDir, "resumes");
  process.env.E2E_MOCK_MODE = "true";
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
  rmSync(tmpDir, { recursive: true, force: true });
});

type AdapterCall = {
  history: NeutralMessage[];
  turnState: TurnState | null;
  toolResults?: ToolResult[];
  allowTools: boolean;
};

function scriptedAdapter(
  steps: Array<
    | {
        toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
        text?: string;
        turnState?: TurnState;
        finish?: "stop" | "blocked";
        throwError?: LlmError;
      }
    | { throwError: LlmError }
  >,
): { adapter: ChatAdapter; calls: AdapterCall[] } {
  const calls: AdapterCall[] = [];
  let index = 0;
  const adapter: ChatAdapter = {
    provider: "mock",
    model: "scripted",
    async chat(input) {
      calls.push({
        history: input.history,
        turnState: input.turnState,
        toolResults: input.toolResults,
        allowTools: input.allowTools,
      });
      const step = steps[index++];
      if (!step) {
        return {
          text: "",
          toolCalls: [],
          finish: "stop",
          finishReason: "stop",
          turnState: input.turnState ?? { provider: "mock", data: null },
        };
      }
      if ("throwError" in step && step.throwError) {
        throw step.throwError;
      }
      const s = step as {
        toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
        text?: string;
        turnState?: TurnState;
        finish?: "stop" | "blocked";
      };
      const turnState =
        s.turnState ?? input.turnState ?? { provider: "mock", data: `step-${index}` };
      const toolCalls = (s.toolCalls ?? []).map((t, i) => ({
        id: `c${index}-${i}`,
        name: t.name,
        args: t.args,
      }));
      return {
        text: s.text ?? "",
        toolCalls,
        finish: s.finish ?? (toolCalls.length ? "stop" : "stop"),
        finishReason: s.finish ?? "stop",
        turnState,
      };
    },
  };
  return { adapter, calls };
}

async function setupQuizActor() {
  const userId = createUser();
  const { conversation } = createConversation(userId);
  const actor = { userId, conversationId: conversation.id };
  confirmProfile(actor, {
    identity: "recent_grad",
    birthDate: "2003-05",
    education: "bachelor",
    workYears: "lt1",
    targetPosition: "",
  });
  return actor;
}

describe("agent loop", () => {
  it("keeps ordinary chat card-free across turns and reloads", async () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const actor = { userId, conversationId: conversation.id };
    for (const text of ["你好", "我是本科毕业，有三年经验，想换工作", "测评是什么", "继续"]) {
      const result = await runChatTurn({ ...actor, text });
      expect(result.messages.some((m) => m.role === "card")).toBe(false);
      expect(result.state.activeCardMessageId).toBeNull();
      expect(result.state.fallbackCard).toBeNull();
    }
    const view = getConversationView(userId, conversation.id);
    expect(view.messages.filter((m) => m.role === "user")).toHaveLength(4);
    expect(view.state.fallbackCard).toBeNull();
  });

  it.each(["开始测评", "填写档案", "生成职业导航报告"])("opens and restores profile card for %s", async (text) => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const actor = { userId, conversationId: conversation.id };
    const result = await runChatTurn({ ...actor, text });
    const card = result.messages.find((m) => m.content.kind === "card");
    expect(card?.content).toMatchObject({ card: { type: "profile_form" } });
    expect(result.state.stage).toBe("profile");
    const view = getConversationView(userId, conversation.id);
    expect(view.state.activeCardMessageId).toBe(card?.id);
    const followup = await runChatTurn({ ...actor, text: "继续" });
    expect(followup.messages.some((m) => m.role === "card")).toBe(true);
  });

  it("executes tool then assistant reply with persisted messages", async () => {
    const actor = await setupQuizActor();
    const before = listMessages(actor.conversationId).length;
    const turnState: TurnState = { provider: "mock", data: "T1" };

    const { adapter, calls } = scriptedAdapter([
      {
        toolCalls: [
          {
            name: "record_quiz_answer",
            args: { questionId: "SJT-01", optionLabel: "A" },
          },
        ],
        turnState,
      },
      { text: "好的" },
    ]);

    const result = await runChatTurn({
      ...actor,
      text: "我选A",
      adapter,
    });

    expect(result.messages.map((m) => m.role)).toEqual(["user", "assistant", "card"]);
    expect(
      result.messages[1].content.kind === "text" && result.messages[1].content.text,
    ).toBe("好的");
    expect(
      result.messages[2].content.kind === "card" &&
        result.messages[2].content.card.type === "quiz_question",
    ).toBe(true);
    expect(listMessages(actor.conversationId).length).toBe(before + 3);
    expect(calls[1].turnState).toEqual(turnState);
    expect(calls[1].toolResults).toHaveLength(1);
  });

  it("skips extra tool calls and enforces tool limit", async () => {
    const actor = await setupQuizActor();
    const toolStep = {
      toolCalls: [
        {
          name: "record_quiz_answer",
          args: { questionId: "SJT-01", optionLabel: "A" },
        },
        {
          name: "record_quiz_answer",
          args: { questionId: "SJT-02", optionLabel: "B" },
        },
      ],
    };

    const { adapter: adapterTwo, calls: callsTwo } = scriptedAdapter([
      toolStep,
      { text: "完成" },
    ]);
    await runChatTurn({ ...actor, text: "答题", adapter: adapterTwo });
    expect(callsTwo[1].toolResults).toHaveLength(2);
    expect(callsTwo[1].toolResults?.[1].response).toEqual({
      skipped: true,
      reason: "一次只执行一个操作",
    });

    const actor2 = await setupQuizActor();
    const fourTools = Array.from({ length: 4 }, (_, i) => ({
      toolCalls: [
        {
          name: "record_quiz_answer",
          args: {
            questionId: ["SJT-01", "SJT-02", "SJT-04", "SJT-05"][i],
            optionLabel: "A",
          },
        },
      ],
    }));
    const { adapter: adapterFour, calls: callsFour } = scriptedAdapter([
      ...fourTools,
      { text: "" },
    ]);
    const limited = await runChatTurn({
      ...actor2,
      text: "连续答题",
      adapter: adapterFour,
    });
    expect(callsFour[3].allowTools).toBe(false);
    expect(
      limited.messages.find(
        (m) => m.role === "assistant" && m.content.kind === "text",
      )?.content,
    ).toMatchObject({ text: COPY.toolLimit });
    const task = ensureActiveTask(actor2);
    expect(listQuizAnswers(task.id)).toHaveLength(3);
  });

  it("handles llm failure, blocked finish, and history shaping", async () => {
    const actor = await setupQuizActor();
    const before = listMessages(actor.conversationId).length;
    const { adapter: failAdapter } = scriptedAdapter([
      {
        toolCalls: [
          {
            name: "record_quiz_answer",
            args: { questionId: "SJT-01", optionLabel: "A" },
          },
        ],
      },
      { throwError: new LlmError("timeout", "timeout") },
    ]);

    await expect(
      runChatTurn({ ...actor, text: "我选A", adapter: failAdapter }),
    ).rejects.toThrow(DomainError);
    expect(listMessages(actor.conversationId).length).toBe(before);
    const task = ensureActiveTask(actor);
    expect(listQuizAnswers(task.id)).toHaveLength(1);
    const view = getConversationView(actor.userId, actor.conversationId);
    expect(view.state.fallbackCard).not.toBeNull();

    const actor2 = await setupQuizActor();
    const { adapter: blockedAdapter } = scriptedAdapter([
      { finish: "blocked", text: "" },
    ]);
    const blocked = await runChatTurn({
      ...actor2,
      text: "你好",
      adapter: blockedAdapter,
    });
    expect(
      blocked.messages.find((m) => m.role === "assistant")?.content,
    ).toMatchObject({ text: COPY.llmBlocked });

    const actor3 = await setupQuizActor();
    insertMessages(actor3.conversationId, [
      { role: "notice", content: { kind: "text", text: "系统提示" } },
      {
        role: "card",
        content: {
          kind: "card",
          card: { type: "profile_form", taskId: ensureActiveTask(actor3).id },
        },
      },
      { role: "user", content: { kind: "text", text: "之前的消息" } },
    ]);
    const history = buildHistory(actor3.conversationId, "本轮输入");
    expect(history[0].role).toBe("user");
    expect(history[history.length - 1]).toEqual({
      role: "user",
      text: "本轮输入",
    });
  });
});
