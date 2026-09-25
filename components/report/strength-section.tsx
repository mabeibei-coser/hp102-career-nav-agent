import { SectionWrapper } from "./section-wrapper";
import type { Strength } from "@/lib/career/types";

type Props = {
  data: Strength;
  index: number;
  total: number;
};

export function StrengthSection({ data, index, total }: Props) {
  const abilities = Array.isArray(data.abilityRadar) ? data.abilityRadar : [];
  const strengths = Array.isArray(data.strengths) ? data.strengths : [];
  const growth = Array.isArray(data.growth) ? data.growth : [];

  return (
    <SectionWrapper id="strength" title="优势发现" index={index} total={total}>
      {abilities.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 text-[11px] font-semibold tracking-wider text-[var(--report-ink-muted)] uppercase">
            能力画像
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {abilities.map((a) => (
              <div
                key={a.name}
                className="rounded-lg border border-[var(--blue-100)] bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--navy-900)]">{a.name}</span>
                <span className="ml-2 text-[var(--report-ink-muted)]">{a.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {strengths.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 text-[11px] font-semibold tracking-wider text-[var(--report-ink-muted)] uppercase">
            核心优势
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {strengths.map((s) => (
              <div key={s.title} className="report-card break-inside-avoid rounded-xl p-5">
                <h3 className="mb-2 text-[15px] font-semibold text-[var(--blue-700)]">
                  {s.title}
                </h3>
                <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {growth.length > 0 && (
        <div>
          <div className="mb-3 text-[11px] font-semibold tracking-wider text-[var(--report-ink-muted)] uppercase">
            可以更进一步
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {growth.map((g) => (
              <div
                key={g.title}
                className="break-inside-avoid rounded-xl border border-[var(--blue-200)] p-5"
                style={{ background: "var(--blue-50)" }}
              >
                <h3 className="mb-2 text-[15px] font-semibold text-[var(--navy-900)]">
                  {g.title}
                </h3>
                <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
                  {g.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionWrapper>
  );
}
