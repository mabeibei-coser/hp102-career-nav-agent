import type { ReportData } from "@/lib/career/types";
import { COPY } from "@/lib/career/copy";
import { OverviewSection } from "./overview-section";
import { StrengthSection } from "./strength-section";
import { PositioningSection } from "./positioning-section";
import { ResumeDiagnosisSection } from "./resume-diagnosis-section";
import { AdviceSection } from "./advice-section";

type ReportViewProps = {
  report: ReportData;
};

export function ReportView({ report }: ReportViewProps) {
  const hasResume = Boolean(report.meta.hasResume && report.resumeDiagnosis);
  const sections = hasResume ? 5 : 4;
  let index = 1;

  return (
    <article className="report-shell mx-auto max-w-[720px] space-y-6 px-4 py-8 text-base">
      <header className="px-1">
        <h1 className="text-2xl font-bold text-[var(--navy-950)]">职业导航报告</h1>
        <p className="mt-1 text-sm text-[var(--report-ink-muted)]">
          {report.overview.personality.type}
        </p>
      </header>

      <OverviewSection data={report.overview} index={index++} total={sections} />
      <StrengthSection data={report.strength} index={index++} total={sections} />
      <PositioningSection
        data={report.positioning}
        index={index++}
        total={sections}
      />
      {hasResume && report.resumeDiagnosis && (
        <ResumeDiagnosisSection
          data={report.resumeDiagnosis}
          index={index++}
          total={sections}
        />
      )}
      <AdviceSection data={report.advice} index={index++} total={sections} />

      <footer className="border-t border-[var(--report-border)] pt-6 text-xs text-[var(--report-ink-muted)]">
        {COPY.disclaimer}
      </footer>
    </article>
  );
}
