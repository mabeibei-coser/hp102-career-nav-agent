import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SectionWrapperProps = {
  id?: string;
  title: string;
  index: number;
  total: number;
  takeaway?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionWrapper({
  id,
  title,
  index,
  total,
  takeaway,
  meta,
  children,
  className,
}: SectionWrapperProps) {
  const paddedIndex = String(index).padStart(2, "0");
  const paddedTotal = String(total).padStart(2, "0");

  return (
    <section
      id={id}
      data-pdf-section={id ?? title}
      className={cn("report-card p-5 sm:p-7 break-inside-avoid-page", className)}
    >
      <header className="mb-5 sm:mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-full bg-[var(--blue-500)] px-2 text-[11px] font-semibold tabular-nums text-white">
            {paddedIndex} / {paddedTotal}
          </span>
          <span className="text-xs tracking-wider text-[var(--report-ink-muted)] uppercase">
            Section
          </span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-[var(--navy-950)] sm:text-2xl">
            {title}
          </h2>
          {meta && (
            <div className="text-[13px] text-[var(--report-ink-muted)]">{meta}</div>
          )}
        </div>
        {takeaway && <p className="report-takeaway mt-4">{takeaway}</p>}
      </header>
      {children}
    </section>
  );
}
