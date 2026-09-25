interface RadarItem {
  name: string;
  score: number;
}

export function SvgRadar({ items }: { items: RadarItem[] }) {
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
        .map(
          (p, j) =>
            `${j === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
        )
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
      .map(
        (p, j) =>
          `${j === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      )
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
          key={`g${i}`}
          d={d}
          fill="none"
          stroke="#dbeafe"
          strokeWidth={i === 3 ? 1 : 0.7}
        />
      ))}
      {spokes.map((d, i) => (
        <path key={`s${i}`} d={d} stroke="#dbeafe" strokeWidth="0.7" />
      ))}
      <path
        d={dataPath}
        fill="#3b82f6"
        fillOpacity="0.18"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {dataPts.map((p, i) => (
        <circle key={`d${i}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
      ))}
      {labels.map((l, i) => (
        <text
          key={`l${i}`}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dominantBaseline="central"
          fontSize="11"
          fill="#374151"
          fontFamily="inherit"
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}
