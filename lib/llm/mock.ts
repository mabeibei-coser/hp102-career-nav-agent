import { readFileSync } from "fs";
import path from "path";
import {
  LlmError,
  type ChatAdapter,
  type JsonProvider,
  type NeutralTool,
  type ToolCall,
  type TurnState,
} from "./types";

const MOCK_TURN_STATE: TurnState = { provider: "mock", data: null };

function lastUserText(history: Array<{ role: string; text: string }>): string {
  const last = history[history.length - 1];
  return last?.text ?? "";
}

function findTool(tools: NeutralTool[], name: string): boolean {
  return tools.some((tool) => tool.name === name);
}

function parseProfileArgs(text: string): Record<string, string> {
  const body = text.slice("档案：".length);
  const args: Record<string, string> = {};
  for (const part of body.split(/[;；]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [key, value] = trimmed.split("=");
    if (key && value) args[key.trim()] = value.trim();
  }
  return args;
}

export function createMockJsonProvider(
  purpose: string = "smoke",
): JsonProvider {
  return {
    provider: "mock",
    model: "mock",
    async completeJsonText(opts) {
      void opts;
      if (process.env.E2E_MOCK_REPORT_FAIL === "true") {
        throw new LlmError("provider_error", "模拟报告生成失败");
      }
      if (purpose === "interview_questions") {
        return {
          text: JSON.stringify({
            questions: [
              {
                id: "Q1",
                text: "（模拟）能说说你最近一段经历里最有成就感的一件事吗？",
                source: "dynamic",
              },
              {
                id: "Q2",
                text: "（模拟）你希望下一份工作在哪些方面和过去不一样？",
                source: "dynamic",
              },
            ],
          }),
          finishReason: "STOP",
        };
      }

      if (purpose === "resume_hints") {
        return {
          text: JSON.stringify({
            education: "bachelor",
            workYears: "lt1",
            targetPosition: "行政专员",
          }),
          finishReason: "STOP",
        };
      }

      if (purpose === "report") {
        const fixturePath = path.join(
          process.cwd(),
          "tests/fixtures/report-mock.json",
        );
        try {
          const text = readFileSync(fixturePath, "utf-8");
          return { text, finishReason: "STOP" };
        } catch {
          throw new LlmError(
            "provider_error",
            `缺少测试夹具 tests/fixtures/report-mock.json`,
          );
        }
      }

      return {
        text: JSON.stringify({ ok: true }),
        finishReason: "STOP",
      };
    },
  };
}

type ChatInput = Parameters<ChatAdapter["chat"]>[0];
type ChatOutput = Awaited<ReturnType<ChatAdapter["chat"]>>;

export class MockChatAdapter implements ChatAdapter {
  provider = "mock" as const;
  model = "mock";

  async chat(opts: ChatInput): Promise<ChatOutput> {
    const u = lastUserText(opts.history);

    if (opts.toolResults && opts.toolResults.length > 0) {
      return {
        text: "好的，我们继续。（模拟回复）",
        toolCalls: [],
        finish: "stop" as const,
        finishReason: "STOP",
        turnState: MOCK_TURN_STATE,
      };
    }

    if (opts.allowTools) {
      const quizMatch = u.match(/^选\s*([ABCD])$/i);
      if (quizMatch && findTool(opts.tools, "record_quiz_answer")) {
        const questionMatch = opts.system.match(/当前题：(SJT-\d{2})/);
        const toolCalls: ToolCall[] = [
          {
            name: "record_quiz_answer",
            args: {
              questionId: questionMatch?.[1] ?? "SJT-01",
              optionLabel: quizMatch[1].toUpperCase(),
            },
          },
        ];
        return {
          text: "",
          toolCalls,
          finish: "stop" as const,
          finishReason: "STOP",
          turnState: MOCK_TURN_STATE,
        };
      }

      if (u.startsWith("档案：") && findTool(opts.tools, "propose_profile")) {
        return {
          text: "",
          toolCalls: [{ name: "propose_profile", args: parseProfileArgs(u) }],
          finish: "stop" as const,
          finishReason: "STOP",
          turnState: MOCK_TURN_STATE,
        };
      }

      if (u.startsWith("回答：") && findTool(opts.tools, "record_interview_answer")) {
        const questionMatch = opts.system.match(/当前题：(Q[1-4])/);
        return {
          text: "",
          toolCalls: [
            {
              name: "record_interview_answer",
              args: {
                questionId: questionMatch?.[1] ?? "Q1",
              },
            },
          ],
          finish: "stop" as const,
          finishReason: "STOP",
          turnState: MOCK_TURN_STATE,
        };
      }

      if (u === "重新开始" && findTool(opts.tools, "request_restart")) {
        return {
          text: "",
          toolCalls: [{ name: "request_restart", args: {} }],
          finish: "stop" as const,
          finishReason: "STOP",
          turnState: MOCK_TURN_STATE,
        };
      }

      if (u === "继续" && findTool(opts.tools, "show_current_step")) {
        return {
          text: "",
          toolCalls: [{ name: "show_current_step", args: {} }],
          finish: "stop" as const,
          finishReason: "STOP",
          turnState: MOCK_TURN_STATE,
        };
      }
    }

    return {
      text: "这是模拟回复。",
      toolCalls: [],
      finish: "stop",
      finishReason: "STOP",
      turnState: MOCK_TURN_STATE,
    };
  }
}
