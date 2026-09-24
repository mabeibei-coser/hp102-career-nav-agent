import { insertLlmCall } from "@/lib/db/repositories/llm-calls";
import { createGeminiChatAdapter } from "./gemini-chat";
import { isMockMode } from "./config";
import { chatLimiter } from "./limiter";
import { MockChatAdapter } from "./mock";
import {
  LlmError,
  type ChatAdapter,
  type NeutralMessage,
  type NeutralTool,
  type ToolResult,
  type TurnState,
} from "./types";

function defaultAdapter(): ChatAdapter {
  if (isMockMode()) {
    return new MockChatAdapter();
  }
  return createGeminiChatAdapter();
}

export async function chatWithTools(input: {
  system: string;
  history: NeutralMessage[];
  turnState: TurnState | null;
  toolResults?: ToolResult[];
  tools: NeutralTool[];
  allowTools: boolean;
  conversationId: string;
  step: number;
  adapter?: ChatAdapter;
  timeoutMs?: number;
}) {
  const adapter = input.adapter ?? defaultAdapter();
  const timeoutMs = input.timeoutMs ?? 30_000;

  return chatLimiter.run(async () => {
    const startedAt = Date.now();
    try {
      const result = await adapter.chat({
        system: input.system,
        history: input.history,
        turnState: input.turnState,
        toolResults: input.toolResults,
        tools: input.tools,
        allowTools: input.allowTools,
        timeoutMs,
      });

      insertLlmCall({
        conversationId: input.conversationId,
        provider: adapter.provider,
        model: adapter.model,
        kind: "chat",
        purpose: "chat",
        step: input.step,
        ok: true,
        finishReason: result.finishReason,
        latencyMs: Date.now() - startedAt,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      });

      return result;
    } catch (error) {
      insertLlmCall({
        conversationId: input.conversationId,
        provider: adapter.provider,
        model: adapter.model,
        kind: "chat",
        purpose: "chat",
        step: input.step,
        ok: false,
        errorCategory:
          error instanceof LlmError ? error.category : "provider_error",
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }
  });
}
