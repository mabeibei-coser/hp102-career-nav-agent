import { Crown, Star } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { cn } from "@/lib/utils";
import type { Positioning, PositionRecommendation } from "@/lib/career/types";

function SvgRadar({ items }: { items: { name: string; score: number }[] }) {
  if (items.length < 3) return null;
  const SIZE = 220;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 72;
  const n = items.length;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, ratio: number) => ({
    x: cx + R * ratio * Math.cos(angle(i)),
    y: cy + R * ratio * Math.sin(angle(i)),
  });

  const grid = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const pts = Array.from({ length: n }, (_, i) => pt(i, ratio));
    return (
      pts
        .map((p, j) => `${j === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ") + "Z"
    );
  });

  const spokes = Array.from({ length: n }, (_, i) => {
    const end = pt(i, 1);
    return `M${cx},${cy}L${end.x.toFixed(1)},${end.y.toFixed(1)}`;
  });

  const dataPts = items.map((d, i) => pt(i, Math.max(0.05, d.score / 100)));
  const dataPath =
    dataPts
      .map((p, j) => `${j === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ") + "Z";

  const labelR = R + 20;
  const labels = items.map((d, i) => {
    const a = angle(i);
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a);
    const eps = 0.2;
    const anchor: "start" | "end" | "middle" =
      Math.cos(a) > eps ? "start" : Math.cos(a) < -eps ? "end" : "middle";
    return { text: d.name, x, y, anchor };
  });

  return (
    <svg
      data-testid="competency-radar"
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      className="overflow-visible"
    >
      {grid.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="var(--blue-100)"
          strokeWidth={i === 3 ? 1 : 0.7}
        />
      ))}
      {spokes.map((d, i) => (
        <path key={i} d={d} stroke="var(--blue-100)" strokeWidth="0.7" />
      ))}
      <path
        d={dataPath}
        fill="var(--blue-500)"
        fillOpacity="0.18"
        stroke="var(--blue-500)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--blue-500)" />
      ))}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dominantBaseline="central"
          fontSize="11"
          fill="var(--navy-700)"
          fontFamily="inherit"
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}

function PositionCard({
  rec,
  variant,
}: {
  rec: PositionRecommendation;
  variant: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  const Icon = isPrimary ? Crown : Star;
  const safeResp = Array.isArray(rec.coreResponsibilities)
    ? rec.coreResponsibilities.slice(0, 5)
    : [];
  const safeComp = Array.isArray(rec.coreCompetencies)
    ? rec.coreCompetencies.slice(0, 6)
    : [];

  return (
    <div
      className={cn(
        "break-inside-avoid rounded-xl border bg-white p-5",
        isPrimary
          ? "border-[var(--blue-500)] ring-1 ring-[var(--blue-500)]"
          : "border-[var(--blue-100)]",
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
            isPrimary
              ? "border-[var(--blue-500)] bg-[var(--blue-500)] text-white"
              : "border-[var(--blue-200)] bg-white text-[var(--navy-700)]",
          )}
        >
          <Icon className="size-3" />
          {isPrimary ? "首选" : "次选"}
        </span>
        <h3
          className={cn(
            "min-w-0 flex-1 font-bold tracking-tight text-[var(--navy-950)]",
            isPrimary ? "text-[20px] sm:text-[22px]" : "text-[18px] sm:text-[20px]",
          )}
        >
          {rec.position || "—"}
        </h3>
      </div>

      {safeResp.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[11px] font-semibold tracking-wider text-[var(--report-ink-muted)] uppercase">
            核心职责
          </div>
          <ul className="space-y-1.5">
            {safeResp.map((r) => (
              <li
                key={r}
                className="flex items-start gap-2 text-[13.5px] leading-[1.65] text-[var(--navy-800)]"
              >
                <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[var(--blue-500)]" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {safeComp.length > 0 && (
        <div className="mb-4">
          <div className="mb-3 text-[11px] font-semibold tracking-wider text-[var(--report-ink-muted)] uppercase">
            核心能力匹配
          </div>
          <div className="flex justify-center py-2">
            <SvgRadar items={safeComp} />
          </div>
        </div>
      )}

      {rec.fitReason && (
        <div className="mb-3 rounded-xl border border-[var(--blue-200)] bg-gradient-to-br from-[var(--blue-50)] to-white p-4">
          <span className="mb-1.5 block text-[12px] font-bold text-[var(--blue-700)]">
            为什么适合你
          </span>
          <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
            {rec.fitReason}
          </p>
        </div>
      )}

      {rec.specialNote && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <span className="mb-1.5 block text-[12px] font-bold text-amber-700">
            特别注意
          </span>
          <p className="text-[13.5px] leading-[1.75] text-amber-900">
            {rec.specialNote}
          </p>
        </div>
      )}
    </div>
  );
}

type Props = {
  data: Positioning;
  index?: number;
  total?: number;
};

export function PositioningSection({ data, index = 3, total = 5 }: Props) {
  const takeaway = data.secondary?.position
    ? `首选：${data.primary.position} · 次选：${data.secondary.position}`
    : `首选方向：${data.primary.position}`;

  return (
    <SectionWrapper
      id="positioning"
      title="职业定位"
      index={index}
      total={total}
      takeaway={takeaway}
    >
      <div className="space-y-5 pt-1">
        <PositionCard rec={data.primary} variant="primary" />
        {data.secondary && (
          <PositionCard rec={data.secondary} variant="secondary" />
        )}
      </div>
    </SectionWrapper>
  );
}
