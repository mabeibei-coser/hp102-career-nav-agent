import { newId } from "../../ids";
import { getDb } from "../client";

export type LlmCallKind = "chat" | "json";
export type LlmCallPurpose =
  | "chat"
  | "interview_questions"
  | "resume_hints"
  | "report"
  | "smoke"
  | "eval";

export type InsertLlmCallInput = {
  conversationId?: string | null;
  provider: string;
  model: string;
  kind: LlmCallKind;
  purpose: LlmCallPurpose;
  step: number;
  ok: boolean;
  errorCategory?: string | null;
  finishReason?: string | null;
  latencyMs: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

export function insertLlmCall(input: InsertLlmCallInput): string {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  db.prepare(
    `INSERT INTO llm_calls (
       id, conversation_id, provider, model, kind, purpose, step, ok, error_category,
       finish_reason, latency_ms, prompt_tokens, completion_tokens, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.conversationId ?? null,
    input.provider,
    input.model,
    input.kind,
    input.purpose,
    input.step,
    input.ok ? 1 : 0,
    input.errorCategory ?? null,
    input.finishReason ?? null,
    input.latencyMs,
    input.promptTokens ?? null,
    input.completionTokens ?? null,
    now,
  );
  return id;
}

export function listLlmCalls(): Array<Record<string, unknown>> {
  const db = getDb();
  return db
    .prepare("SELECT * FROM llm_calls ORDER BY created_at ASC, step ASC")
    .all() as Array<Record<string, unknown>>;
}
