"use client";

import type { CardPayload } from "@/lib/career/cards";
import { CardShell } from "./card-shell";

type ReportStatusCard = Extract<CardPayload, { type: "report_status" }>;

type ReportStatusCardProps = {
  card: ReportStatusCard;
  active: boolean;
  disabled?: boolean;
  onRetry: () => void;
  loadingAction?: boolean;
};

export function ReportStatusCardView({
  card,
  active,
  disabled,
  onRetry,
  loadingAction,
}: ReportStatusCardProps) {
  if (card.status === "generating") {
    return (
      <CardShell inactive={!active}>
        <div className="flex items-center gap-3">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
            aria-hidden
          />
          <div>
            <p className="text-base font-medium">报告生成中</p>
            <p className="text-sm text-gray-500">
              通常需要 1–3 分钟，你可以先问我问题
            </p>
          </div>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell inactive={!active}>
      <p className="mb-1 text-base font-medium text-red-600">报告生成失败</p>
      <p className="mb-4 text-base text-gray-700">
        {card.errorMessage ?? "生成服务暂时不可用"}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={!active || disabled || loadingAction}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-base font-medium text-white disabled:opacity-40 min-h-[44px]"
      >
        {loadingAction ? "提交中…" : "重试"}
      </button>
    </CardShell>
  );
}
