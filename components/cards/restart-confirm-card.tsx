"use client";

import type { CardPayload } from "@/lib/career/cards";
import { CardShell } from "./card-shell";

type RestartCard = Extract<CardPayload, { type: "restart_confirm" }>;

type RestartConfirmCardProps = {
  card: RestartCard;
  active: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loadingAction?: boolean;
};

export function RestartConfirmCardView({
  active,
  disabled,
  onConfirm,
  onCancel,
  loadingAction,
}: RestartConfirmCardProps) {
  return (
    <CardShell inactive={!active}>
      <p className="mb-4 text-base text-gray-700">
        确定要重新开始职业导航吗？之前的报告会保留。
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!active || disabled || loadingAction}
          className="flex-1 rounded-lg bg-red-600 py-3 text-base font-medium text-white disabled:opacity-40 min-h-[44px]"
        >
          {loadingAction ? "处理中…" : "确认重新开始"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!active || disabled || loadingAction}
          className="flex-1 rounded-lg border border-gray-300 py-3 text-base font-medium disabled:opacity-40 min-h-[44px]"
        >
          继续当前进度
        </button>
      </div>
    </CardShell>
  );
}
