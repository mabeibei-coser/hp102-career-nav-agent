"use client";

import { useState } from "react";
import type { CardPayload } from "@/lib/career/cards";
import { CardShell } from "./card-shell";

type InterviewCard = Extract<CardPayload, { type: "interview_question" }>;

type InterviewQuestionCardProps = {
  card: InterviewCard;
  active: boolean;
  disabled?: boolean;
  answeredText?: string;
  onSubmit: (text: string) => void;
  loadingAction?: boolean;
};

export function InterviewQuestionCardView({
  card,
  active,
  disabled,
  answeredText,
  onSubmit,
  loadingAction,
}: InterviewQuestionCardProps) {
  const [text, setText] = useState(answeredText ?? "");
  const readOnly = !active || !!answeredText;
  const trimmed = text.trim();
  const canSubmit =
    active && !disabled && !loadingAction && trimmed.length >= 2;

  return (
    <CardShell inactive={!active}>
      <p className="mb-1 text-sm text-gray-500">
        访谈 第 {card.index}/{card.total} 题
      </p>
      <p className="mb-4 text-base font-medium">{card.text}</p>
      {readOnly && answeredText ? (
        <p className="rounded-lg bg-gray-50 p-3 text-base text-gray-700">
          {answeredText}
        </p>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            disabled={readOnly || disabled}
            placeholder="说说你的真实想法…"
            rows={3}
            className="mb-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-base disabled:bg-gray-50"
          />
          <p className="mb-3 text-xs text-gray-500">
            也可以直接在下方输入框回答
          </p>
          <button
            type="button"
            onClick={() => canSubmit && onSubmit(trimmed)}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-40 min-h-[44px]"
          >
            {loadingAction ? "提交中…" : "提交回答"}
          </button>
        </>
      )}
    </CardShell>
  );
}
