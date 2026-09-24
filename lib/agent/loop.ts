import { DomainError } from "@/lib/errors";
import { withTransaction } from "@/lib/db/client";
import { insertMessages } from "@/lib/db/repositories/messages";
import { listMessages } from "@/lib/db/repositories/messages";
import { COPY } from "@/lib/career/copy";
import { chatWithTools } from "@/lib/llm/chat";
import { LlmError, type ChatAdapter, type NeutralMessage, type ToolResult } from "@/lib/llm/types";
import { withConversationLock } from "@/lib/conversation/lock";
import { assertChatRate } from "@/lib/conversation/rate-limit";
import { getConversationView, type ChatMessage } from "@/lib/conversation/view";
import { ensureActiveTask } from "@/lib/career/service";
import { buildSystemPrompt, loadAgentContext } from "./prompt";
import { executeTool, toolDefsFor, toolResultForModel } from "./tools";

function cardSummary(card: { type: string; [key: string]: unknown }): string {
  switch (card.type) {
    case "profile_form":
      return "[展示了档案确认卡]";
    case "quiz_question":
      return `[展示了第${card.index}题卡片：${card.questionId}]`;
    case "interview_question":
      return `[展示了访谈第${card.index}题卡片：${card.questionId}]`;
    case "report_cta":
      return "[展示了“生成报告”按钮]";
    case "report_status":
      return `[报告状态：${card.status === "generating" ? "生成中" : "失败"}]`;
    case "report_summary":
      return "[展示了报告摘要卡]";
    case "restart_confirm":
      return "[展示了重新开始确认卡]";
    default:
      return `[展示了卡片：${card.type}]`;
  }
}

export function buildHistory(
  conversationId: string,
  currentText: string,
): NeutralMessage[] {
  const rows = listMessages(conversationId).slice(-40);
  const converted: NeutralMessage[] = [];
  for (const row of rows) {
    const content = row.content as {
      kind: string;
      text?: string;
      card?: { type: string; [key: string]: unknown };
    };
    if (content.kind === "text") {
      const role = row.role === "user" ? "user" : "assistant";
      converted.push({ role, text: content.text ?? "" });
    } else if (content.kind === "card" && content.card) {
      converted.push({ role: "assistant", text: cardSummary(content.card) });
    }
  }

  const merged: NeutralMessage[] = [];
  for (const msg of converted) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.text = `${last.text}\n${msg.text}`;
    } else {
      merged.push({ ...msg });
    }
  }

  while (merged.length > 0 && merged[0].role !== "user") {
    merged.shift();
  }

  merged.push({ role: "user", text: currentText });
  return merged;
}

export async function runChatTurn(input: {
  userId: string;
  conversationId: string;
  text: string;
  adapter?: ChatAdapter;
}): Promise<{ messages: ChatMessage[]; state: ReturnType<typeof getConversationView>["state"] }> {
  const text = input.text.trim();
  if (text.length < 1 || text.length > 1000) {
    throw new DomainError("INVALID_INPUT");
  }

  return withConversationLock(input.conversationId, async () => {
    assertChatRate(input.userId);
    const actor = { userId: input.userId, conversationId: input.conversationId };
    ensureActiveTask(actor);

    const userMsg = {
      role: "user" as const,
      content: { kind: "text" as const, text, source: "chat" as const },
    };

    let turnState = null;
    let toolResults: ToolResult[] | undefined;
    const pendingCards: unknown[] = [];
    const pendingNotices: string[] = [];
    let finalText = "";
    let toolsExecuted = 0;

    try {
      for (let step = 1; step <= 4; step++) {
        const ctx = loadAgentContext(actor);
        const system = buildSystemPrompt(actor, ctx);
        const history = buildHistory(input.conversationId, text);
        const res = await chatWithTools({
          system,
          history,
          turnState,
          toolResults,
          tools: toolDefsFor(ctx.task.stage),
          allowTools: toolsExecuted < 3,
          conversationId: input.conversationId,
          step,
          adapter: input.adapter,
        });

        turnState = res.turnState;
        toolResults = undefined;

        if (res.finish === "blocked") {
          finalText = COPY.llmBlocked;
          break;
        }

        if (res.toolCalls.length === 0 || toolsExecuted >= 3) {
          finalText = res.text;
          break;
        }

        const results: ToolResult[] = [];
        const first = res.toolCalls[0];
        const exec = await executeTool(first, actor, ctx, { userText: text });
        toolsExecuted += 1;
        if (exec.ok) {
          pendingCards.push(...exec.result.cards);
          pendingNotices.push(...exec.result.notices);
        }
        results.push({
          call: first,
          response: toolResultForModel(exec),
        });
        for (const skipped of res.toolCalls.slice(1)) {
          results.push({
            call: skipped,
            response: {
              skipped: true,
              reason: "一次只执行一个操作",
            },
          });
        }
        toolResults = results;
      }

      if (!finalText && toolsExecuted === 3) {
        finalText = COPY.toolLimit;
      }

      const toInsert: Array<{
        role: "user" | "assistant" | "notice" | "card";
        content: unknown;
      }> = [userMsg];

      if (finalText) {
        toInsert.push({
          role: "assistant",
          content: { kind: "text", text: finalText },
        });
        for (const card of pendingCards) {
          toInsert.push({ role: "card", content: { kind: "card", card } });
        }
      } else {
        for (const notice of pendingNotices) {
          toInsert.push({ role: "notice", content: { kind: "text", text: notice } });
        }
        for (const card of pendingCards) {
          toInsert.push({ role: "card", content: { kind: "card", card } });
        }
      }

      const inserted = withTransaction(() =>
        insertMessages(input.conversationId, toInsert),
      );
      const view = getConversationView(input.userId, input.conversationId);
      const messages: ChatMessage[] = inserted.map((m) => ({
        id: m.id,
        seq: m.seq,
        role: m.role,
        content: m.content as ChatMessage["content"],
        createdAt: m.createdAt,
      }));
      return { messages, state: view.state };
    } catch (err) {
      if (err instanceof LlmError) {
        throw new DomainError("LLM_UNAVAILABLE");
      }
      throw err;
    }
  });
}
