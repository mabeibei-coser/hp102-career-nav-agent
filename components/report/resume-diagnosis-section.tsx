import { SectionWrapper } from "./section-wrapper";
import type { ResumeDiagnosis } from "@/lib/career/types";

type Props = {
  data: ResumeDiagnosis;
  index?: number;
  total?: number;
};

const PRIORITY_TONE: Record<"high" | "medium" | "low", "danger" | "warning" | undefined> = {
  high: "danger",
  medium: "warning",
  low: undefined,
};

const PRIORITY_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "建议优先补充",
  medium: "建议加强",
  low: "可以补充",
};

function getScoreColor(score: number) {
  if (score >= 85) return "var(--blue-700)";
  if (score >= 70) return "var(--blue-600)";
  if (score >= 55) return "oklch(0.55 0.14 55)";
  return "oklch(0.5 0.16 25)";
}

export function ResumeDiagnosisSection({
  data,
  index = 4,
  total = 5,
}: Props) {
  const rawScore =
    typeof data.overallScore === "number" && Number.isFinite(data.overallScore)
      ? data.overallScore
      : 0;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const scoreColor = getScoreColor(score);
  const issues = Array.isArray(data.issues) ? data.issues : [];

  const ringSize = 92;
  const stroke = 8;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <SectionWrapper
      id="resume-diagnosis"
      title="简历快诊"
      index={index}
      total={total}
      meta={<span>{issues.length} 条可补充</span>}
    >
      <div className="mb-5 break-inside-avoid rounded-xl border border-[var(--blue-100)] bg-gradient-to-br from-[var(--blue-50)]/60 to-white p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div
            className="relative shrink-0"
            style={{ width: ringSize, height: ringSize }}
            aria-label={`简历完成度 ${score} 分`}
          >
            <svg
              width={ringSize}
              height={ringSize}
              viewBox={`0 0 ${ringSize} ${ringSize}`}
              className="-rotate-90"
            >
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="var(--blue-100)"
                strokeWidth={stroke}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[18px] font-bold text-[var(--navy-900)]">
              {score}
            </div>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[var(--navy-900)]">
              简历完成度
            </p>
            <p className="text-[13px] text-[var(--report-ink-muted)]">
              按目标岗位对齐后的综合评分
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {issues.map((issue) => {
          const priority = (["high", "medium", "low"].includes(issue.priority)
            ? issue.priority
            : "medium") as "high" | "medium" | "low";
          const tone = PRIORITY_TONE[priority];
          return (
            <div
              key={issue.title}
              className="break-inside-avoid rounded-xl border border-[var(--blue-100)] bg-white p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-[var(--navy-900)]">
                  {issue.title}
                </h3>
                <span className="report-chip" data-tone={tone}>
                  {PRIORITY_LABEL[priority]}
                </span>
              </div>
              <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
                {issue.detail}
              </p>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
