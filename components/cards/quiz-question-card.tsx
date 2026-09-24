"use client";

import type { CardPayload } from "@/lib/career/cards";
import type { OptionLabel } from "@/lib/career/types";
import { CardShell } from "./card-shell";

type QuizCard = Extract<CardPayload, { type: "quiz_question" }>;

type QuizQuestionCardProps = {
  card: QuizCard;
  active: boolean;
  disabled?: boolean;
  selectedLabel?: OptionLabel;
  onAnswer: (optionLabel: OptionLabel) => void;
  loadingAction?: boolean;
};

export function QuizQuestionCardView({
  card,
  active,
  disabled,
  selectedLabel,
  onAnswer,
  loadingAction,
}: QuizQuestionCardProps) {
  const readOnly = !active || !!selectedLabel;

  return (
    <CardShell inactive={!active}>
      <p className="mb-1 text-sm text-gray-500">
        第 {card.index}/{card.total} 题
      </p>
      <p className="mb-4 text-base font-medium">{card.text}</p>
      <div className="space-y-2">
        {card.options.map((opt) => {
          const isSelected = selectedLabel === opt.label;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => !readOnly && onAnswer(opt.label)}
              disabled={readOnly || disabled || loadingAction}
              className={`w-full rounded-lg border px-4 py-3 text-left text-base transition-colors min-h-[44px] ${
                isSelected
                  ? "border-blue-600 bg-blue-50 font-medium text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              } disabled:opacity-60`}
            >
              <span className="mr-2 font-semibold">{opt.label}.</span>
              {opt.text}
            </button>
          );
        })}
      </div>
    </CardShell>
  );
}
