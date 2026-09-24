"use client";

import Link from "next/link";
import type { CardPayload } from "@/lib/career/cards";
import { COPY } from "@/lib/career/copy";
import { BipolarBar } from "./bipolar-bar";
import { CardShell } from "./card-shell";

type ReportSummaryCard = Extract<CardPayload, { type: "report_summary" }>;

type ReportSummaryCardProps = {
  card: ReportSummaryCard;
};

export function ReportSummaryCardView({ card }: ReportSummaryCardProps) {
  return (
    <CardShell title="报告摘要">
      <div className="space-y-4 text-base">
        <div>
          <p className="text-sm text-gray-500">性格类型</p>
          <p className="font-medium">{card.personalityType}</p>
        </div>

        <div>
          <p className="mb-2 text-sm text-gray-500">总评</p>
          <p className="text-gray-700">{card.summary}</p>
        </div>

        <div className="space-y-3">
          {card.fourDim.map((dim) => (
            <div key={dim.name}>
              <p className="mb-1 text-sm font-medium">{dim.name}</p>
              <BipolarBar left={dim.left} right={dim.right} score={dim.score} />
            </div>
          ))}
        </div>

        <div>
          <p className="text-sm text-gray-500">首选岗位</p>
          <p className="font-medium">{card.primary.position}</p>
          {card.primary.fitReason && (
            <p className="mt-1 text-sm text-gray-600">
              {card.primary.fitReason}
            </p>
          )}
        </div>

        <div>
          <p className="text-sm text-gray-500">次选岗位</p>
          <p className="font-medium">{card.secondary.position}</p>
        </div>

        <div>
          <p className="mb-2 text-sm text-gray-500">行动计划</p>
          <ol className="list-decimal space-y-1 pl-5 text-gray-700">
            {card.topThree.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ol>
        </div>

        <Link
          href={`/report/${card.reportUuid}`}
          className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-base font-medium text-white"
        >
          查看完整报告
        </Link>

        <p className="text-xs text-gray-500">{COPY.disclaimer}</p>
      </div>
    </CardShell>
  );
}
