import { getBananaRouterConfig } from "./config";
import {
  extractText,
  normalizeFinishReason,
  requestGenerateContent,
  type FetchImpl,
  type GeminiContent,
} from "./gemini-http";
import {
  LlmError,
  type ChatAdapter,
  type NeutralMessage,
  type NeutralTool,
  type ToolCall,
  type ToolResult,
  type TurnState,
} from "./types";

function historyToContents(history: NeutralMessage[]): GeminiContent[] {
  const prior = history.slice(0, -1);
  return prior.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text }],
  }));
}

function buildCurrentTurnContents(
  history: NeutralMessage[],
  turnState: TurnState | null,
  toolResults?: ToolResult[],
): GeminiContent[] {
  const contents: GeminiContent[] = [];

  if (turnState?.data) {
    const saved = turnState.data as GeminiContent[];
    contents.push(...saved);
  } else {
    const last = history[history.length - 1];
    contents.push({
      role: "user",
      parts: [{ text: last.text }],
    });
  }

  if (toolResults && toolResults.length > 0) {
    contents.push({
      role: "user",
      parts: toolResults.map((result) => {
        const functionResponse: Record<string, unknown> = {
          name: result.call.name,
          response: result.response,
        };
        if (result.call.id) {
          functionResponse.id = result.call.id;
        }
        return { functionResponse };
      }),
    });
  }

  return contents;
}

function mapTools(tools: NeutralTool[]) {
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

function extractToolCalls(content: GeminiContent | undefined): ToolCall[] {
  const parts = content?.parts;
  if (!Array.isArray(parts)) return [];

  const toolCalls: ToolCall[] = [];
  for (const part of parts) {
    const functionCall = part.functionCall as
      | { name?: string; args?: Record<string, unknown>; id?: string }
      | undefined;
    if (!functionCall?.name) continue;
    toolCalls.push({
      id: functionCall.id,
      name: functionCall.name,
      args: functionCall.args ?? {},
    });
  }
  return toolCalls;
}

export function createGeminiChatAdapter(input?: {
  fetchImpl?: FetchImpl;
}): ChatAdapter {
  const config = getBananaRouterConfig();
  const fetchImpl = input?.fetchImpl;

  return {
    provider: "bananarouter",
    model: config.model,
    async chat(opts) {
      const priorContents = historyToContents(opts.history);
      const currentContents = buildCurrentTurnContents(
        opts.history,
        opts.turnState,
        opts.toolResults,
      );

      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [...priorContents, ...currentContents],
        tools: mapTools(opts.tools),
        toolConfig: {
          functionCallingConfig: {
            mode: opts.allowTools ? "AUTO" : "NONE",
          },
        },
        generationConfig: {
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: "minimal" },
        },
      };

      const { candidate, usage } = await requestGenerateContent({
        config,
        fetchImpl,
        timeoutMs: opts.timeoutMs,
        body,
      });

      const finishReason = candidate.finishReason ?? "";
      const payload = { candidates: [candidate] };
      const normalized = normalizeFinishReason(finishReason, payload);

      if (normalized === "blocked") {
        return {
          text: "",
          toolCalls: [],
          finish: "blocked",
          finishReason,
          turnState: {
            provider: "bananarouter",
            data: currentContents,
          },
          usage,
        };
      }

      if (normalized === "invalid_response") {
        throw new LlmError("invalid_response", "BananaRouter 返回内容无效");
      }

      const modelContent = candidate.content;
      const newTurnContents = [...currentContents, modelContent];
      const toolCalls = extractToolCalls(modelContent);
      const text = extractText(modelContent);

      return {
        text,
        toolCalls,
        finish: normalized === "max_tokens" ? "max_tokens" : "stop",
        finishReason,
        turnState: {
          provider: "bananarouter",
          data: newTurnContents,
        },
        usage,
      };
    },
  };
}
