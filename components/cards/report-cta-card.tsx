"use client";

import type { CardPayload } from "@/lib/career/cards";
import { CardShell } from "./card-shell";

type ReportCtaCard = Extract<CardPayload, { type: "report_cta" }>;

type ReportCtaCardProps = {
  card: ReportCtaCard;
  active: boolean;
  disabled?: boolean;
  onGenerate: () => void;
  loadingAction?: boolean;
};

export function ReportCtaCardView({
  active,
  disabled,
  onGenerate,
  loadingAction,
}: ReportCtaCardProps) {
  return (
    <CardShell inactive={!active}>
      <p className="mb-4 text-base text-gray-700">
        访谈已完成，可以生成你的专属职业导航报告。
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={!active || disabled || loadingAction}
        className="w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-40 min-h-[44px]"
      >
        {loadingAction ? "提交中…" : "生成我的职业导航报告"}
      </button>
      <p className="mt-2 text-center text-sm text-gray-500">
        大约需要 1–3 分钟
      </p>
    </CardShell>
  );
}
