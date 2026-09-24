import type { BananaRouterConfig } from "./config";
import { LlmError } from "./types";

export type GeminiContent = {
  role?: string;
  parts?: Array<Record<string, unknown>>;
};

export type GeminiCandidate = {
  content?: GeminiContent;
  finishReason?: string;
};

export type GeminiResponse = {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

export type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "RECITATION",
  "OTHER",
]);

export function extractText(content: GeminiContent | undefined): string {
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

export function isBlockedResponse(
  payload: GeminiResponse,
  finishReason?: string,
): boolean {
  if (payload.promptFeedback?.blockReason) return true;
  return finishReason ? BLOCKED_FINISH_REASONS.has(finishReason) : false;
}

export function normalizeFinishReason(
  finishReason: string | undefined,
  payload: GeminiResponse,
): "stop" | "max_tokens" | "blocked" | "invalid_response" {
  if (isBlockedResponse(payload, finishReason)) return "blocked";
  if (finishReason === "STOP") return "stop";
  if (finishReason === "MAX_TOKENS") return "max_tokens";
  if (finishReason === "MALFORMED_FUNCTION_CALL") return "invalid_response";
  if (!finishReason) return "invalid_response";
  return "invalid_response";
}

function usageFromMetadata(
  usageMetadata?: GeminiResponse["usageMetadata"],
): { promptTokens?: number; completionTokens?: number } | undefined {
  if (!usageMetadata) return undefined;
  return {
    promptTokens: usageMetadata.promptTokenCount,
    completionTokens: usageMetadata.candidatesTokenCount,
  };
}

export async function requestGenerateContent(input: {
  config: BananaRouterConfig;
  body: Record<string, unknown>;
  timeoutMs: number;
  fetchImpl?: FetchImpl;
}): Promise<{
  candidate: GeminiCandidate;
  promptFeedback?: GeminiResponse["promptFeedback"];
  usageMetadata?: GeminiResponse["usageMetadata"];
  usage?: { promptTokens?: number; completionTokens?: number };
}> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const endpoint =
    `${input.config.baseURL}/v1beta/models/` +
    `${encodeURIComponent(input.config.model)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${input.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new LlmError("unauthorized", "BananaRouter 鉴权失败");
    }
    if (response.status === 429) {
      throw new LlmError("rate_limited", "BananaRouter 请求受限");
    }
    if (!response.ok) {
      throw new LlmError(
        "provider_error",
        `BananaRouter 上游失败（HTTP ${response.status}）`,
      );
    }

    let payload: GeminiResponse;
    try {
      payload = (await response.json()) as GeminiResponse;
    } catch {
      throw new LlmError("invalid_response", "BananaRouter 返回内容无效");
    }

    if (payload.promptFeedback?.blockReason) {
      throw new LlmError("blocked", "BananaRouter 内容被拦截");
    }

    const candidate = payload.candidates?.[0];
    if (!candidate?.content) {
      throw new LlmError("invalid_response", "BananaRouter 返回内容无效");
    }

    const finishReason = candidate.finishReason;
    if (finishReason === "MALFORMED_FUNCTION_CALL") {
      throw new LlmError("invalid_response", "BananaRouter 返回内容无效");
    }

    return {
      candidate,
      promptFeedback: payload.promptFeedback,
      usageMetadata: payload.usageMetadata,
      usage: usageFromMetadata(payload.usageMetadata),
    };
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (controller.signal.aborted) {
      throw new LlmError("timeout", "BananaRouter 请求超时");
    }
    throw new LlmError("network_error", "BananaRouter 网络请求失败");
  } finally {
    clearTimeout(timer);
  }
}
