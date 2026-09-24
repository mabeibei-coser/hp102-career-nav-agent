import { insertLlmCall } from "@/lib/db/repositories/llm-calls";
import { createGeminiJsonProvider } from "./gemini-json";
import { isMockMode } from "./config";
import {
  extractJson,
  JSON_ONLY_PREFIX,
  stripReasoning,
  tryFixAndParse,
} from "./json-utils";
import { createMockJsonProvider } from "./mock";
import { LlmError, type JsonProvider, type ProviderName } from "./types";

export type GenerateJsonPurpose =
  | "interview_questions"
  | "resume_hints"
  | "report"
  | "smoke"
  | "eval";

const RETRYABLE_CATEGORIES = new Set([
  "invalid_json",
  "provider_error",
  "network_error",
  "timeout",
  "invalid_response",
]);

function defaultProvider(purpose: GenerateJsonPurpose): JsonProvider {
  if (isMockMode()) {
    return createMockJsonProvider(purpose);
  }
  return createGeminiJsonProvider();
}

function assertJsonPrompt(system: string, user: string): void {
  if (!(system + user).toLowerCase().includes("json")) {
    throw new Error(
      "generateJson: system or user prompt must include 'json' literal",
    );
  }
}

export async function generateJson<T>(opts: {
  purpose: GenerateJsonPurpose;
  conversationId?: string;
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  validator?: (data: T) => string | null;
  onValidationFailure?: (issue: string, data: T) => { user: string } | null;
  provider?: JsonProvider;
  retryDelayMs?: number;
}): Promise<{ data: T; provider: ProviderName; model: string }> {
  assertJsonPrompt(opts.system, opts.user);

  const provider = opts.provider ?? defaultProvider(opts.purpose);
  const retryDelayMs = opts.retryDelayMs ?? 1000;
  let currentUser = opts.user;
  let lastValidationIssue: string | null = null;
  let lastValidationData: T | undefined;

  for (let step = 1; step <= 2; step++) {
    const startedAt = Date.now();
    let finishReason: string | undefined;
    let usage:
      | { promptTokens?: number; completionTokens?: number }
      | undefined;

    try {
      const result = await provider.completeJsonText({
        system: JSON_ONLY_PREFIX + opts.system,
        user: currentUser,
        maxOutputTokens: opts.maxOutputTokens,
        temperature: opts.temperature,
        timeoutMs: opts.timeoutMs,
      });

      finishReason = result.finishReason;
      usage = result.usage;

      const cleaned = stripReasoning(result.text);
      const jsonStr = extractJson(cleaned);
      let data: T;
      try {
        data = tryFixAndParse(jsonStr) as T;
      } catch {
        throw new LlmError("invalid_json", "模型返回不是有效 JSON");
      }

      if (opts.validator) {
        const issue = opts.validator(data);
        if (issue) {
          lastValidationIssue = issue;
          lastValidationData = data;
          throw new LlmError("validation_failed", `内容校验失败: ${issue}`);
        }
      }

      insertLlmCall({
        conversationId: opts.conversationId,
        provider: provider.provider,
        model: provider.model,
        kind: "json",
        purpose: opts.purpose,
        step,
        ok: true,
        finishReason,
        latencyMs: Date.now() - startedAt,
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
      });

      return { data, provider: provider.provider, model: provider.model };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      if (error instanceof LlmError) {
        insertLlmCall({
          conversationId: opts.conversationId,
          provider: provider.provider,
          model: provider.model,
          kind: "json",
          purpose: opts.purpose,
          step,
          ok: false,
          errorCategory: error.category,
          finishReason,
          latencyMs,
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
        });

        if (step === 2) throw error;

        if (
          error.category === "validation_failed" &&
          opts.onValidationFailure &&
          lastValidationIssue
        ) {
          const patch = opts.onValidationFailure(
            lastValidationIssue,
            lastValidationData as T,
          );
          if (patch) {
            currentUser = patch.user;
            continue;
          }
          throw error;
        }

        if (!RETRYABLE_CATEGORIES.has(error.category)) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      insertLlmCall({
        conversationId: opts.conversationId,
        provider: provider.provider,
        model: provider.model,
        kind: "json",
        purpose: opts.purpose,
        step,
        ok: false,
        errorCategory: "provider_error",
        latencyMs,
      });
      throw error;
    }
  }

  throw new LlmError("provider_error", "JSON 生成失败");
}
