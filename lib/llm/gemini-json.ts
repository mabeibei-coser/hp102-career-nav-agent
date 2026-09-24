import { getBananaRouterConfig } from "./config";
import {
  extractText,
  isBlockedResponse,
  requestGenerateContent,
  type FetchImpl,
} from "./gemini-http";
import { LlmError, type JsonProvider } from "./types";

export function createGeminiJsonProvider(input?: {
  fetchImpl?: FetchImpl;
}): JsonProvider {
  const config = getBananaRouterConfig();
  const fetchImpl = input?.fetchImpl;

  return {
    provider: "bananarouter",
    model: config.model,
    async completeJsonText(opts) {
      const { candidate, usage } = await requestGenerateContent({
        config,
        fetchImpl,
        timeoutMs: opts.timeoutMs,
        body: {
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts: [{ text: opts.user }] }],
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxOutputTokens,
            responseMimeType: "application/json",
          },
        },
      });

      const finishReason = candidate.finishReason ?? "";
      const payload = { candidates: [candidate] };
      if (isBlockedResponse(payload, finishReason)) {
        throw new LlmError("blocked", "BananaRouter 内容被拦截");
      }

      const text = extractText(candidate.content);
      if (!text) {
        throw new LlmError("invalid_response", "BananaRouter 返回内容无效");
      }

      return {
        text,
        finishReason,
        usage,
      };
    },
  };
}

export async function completeJsonText(input: {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  fetchImpl?: FetchImpl;
}): Promise<{
  text: string;
  finishReason: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}> {
  const provider = createGeminiJsonProvider({ fetchImpl: input.fetchImpl });
  return provider.completeJsonText(input);
}
