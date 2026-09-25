import { Clock } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import type { Advice } from "@/lib/career/types";

type Props = {
  data: Advice;
  index: number;
  total: number;
};

export function AdviceSection({ data, index, total }: Props) {
  const topThree = Array.isArray(data.topThree) ? data.topThree.slice(0, 3) : [];

  return (
    <SectionWrapper id="advice" title="行动计划" index={index} total={total}>
      <div className="space-y-4">
        {topThree.map((item, i) => (
          <div
            key={item.title}
            className="break-inside-avoid overflow-hidden rounded-xl border border-[var(--blue-200)] border-l-4 bg-white"
            data-testid="advice-item"
          >
            <div className="p-5">
              <div className="mb-3 flex items-start gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--blue-600)] text-[13px] font-bold tabular-nums text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] leading-snug font-semibold text-[var(--navy-950)]">
                    {item.title}
                  </h3>
                </div>
                {item.deadline && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--blue-50)] px-2.5 py-1 text-[11px] font-semibold text-[var(--blue-600)]">
                    <Clock className="size-3" />
                    {item.deadline}
                  </span>
                )}
              </div>
              <p className="pl-10 text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
