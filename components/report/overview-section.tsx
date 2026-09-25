import { SectionWrapper } from "./section-wrapper";
import { BipolarBar } from "@/components/cards/bipolar-bar";
import type { Overview } from "@/lib/career/types";

type Props = {
  data: Overview;
  index: number;
  total: number;
};

const BIPOLAR_POLES = [
  { left: "内敛沉稳", right: "主动外向" },
  { left: "按部就班", right: "灵活应变" },
  { left: "稳定务实", right: "探索成长" },
  { left: "专注深耕", right: "多元适应" },
];

function extractPersonalityLabel(raw: string): string {
  const sep = raw.indexOf("·");
  if (sep < 0) return raw.trim();
  const before = raw.slice(0, sep).trim();
  if (/^[A-Za-z]{2,6}$/.test(before)) return raw.slice(sep + 1).trim();
  return raw.trim();
}

export function OverviewSection({ data, index, total }: Props) {
  const traits = Array.isArray(data.personality?.traits)
    ? data.personality.traits
    : [];
  const fourDim = Array.isArray(data.fourDimRadar) ? data.fourDimRadar : [];
  const personalityLabel = extractPersonalityLabel(data.personality?.type ?? "");

  return (
    <SectionWrapper id="overview" title="总评" index={index} total={total}>
      {fourDim.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 text-[11px] font-semibold tracking-wider text-[var(--report-ink-muted)] uppercase">
            四维评估
          </div>
          <div className="grid grid-cols-1 gap-3 break-inside-avoid sm:grid-cols-2">
            {fourDim.map((dim, i) => {
              const poles = BIPOLAR_POLES[i] ?? BIPOLAR_POLES[0];
              return (
                <div
                  key={dim.name}
                  className="rounded-xl border border-[var(--blue-100)] bg-white p-4 sm:p-5"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[var(--navy-900)]">
                      {dim.name}
                    </span>
                  </div>
                  {dim.conclusion && (
                    <p className="mb-3 text-[13.5px] leading-relaxed text-[var(--navy-800)]">
                      {dim.conclusion}
                    </p>
                  )}
                  <BipolarBar
                    left={poles.left}
                    right={poles.right}
                    score={dim.score}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.personality && (
        <div className="mb-6">
          <div className="mb-3 text-[11px] font-semibold tracking-wider text-[var(--report-ink-muted)] uppercase">
            职业性格解读
          </div>
          <div className="break-inside-avoid rounded-xl border border-[var(--blue-100)] bg-white p-5">
            <div className="mb-3">
              <span className="text-[19px] font-bold tracking-tight text-[var(--navy-900)] sm:text-[22px]">
                {personalityLabel || data.personality.type}
              </span>
            </div>
            {traits.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {traits.map((t) => (
                  <span key={t} className="report-chip">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {data.personality.description && (
              <p className="text-[14px] leading-[1.75] text-[var(--navy-800)]">
                {data.personality.description}
              </p>
            )}
          </div>
        </div>
      )}

      {data.summary && (
        <div>
          <div className="mb-3 text-[11px] font-semibold tracking-wider text-[var(--report-ink-muted)] uppercase">
            综合评价
          </div>
          <p className="report-takeaway">{data.summary}</p>
        </div>
      )}
    </SectionWrapper>
  );
}
