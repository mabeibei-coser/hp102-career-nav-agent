import type {
  Advice,
  Overview,
  Positioning,
  PositionRecommendation,
  ScoringResult,
  Strength,
} from "../types";

const PLACEHOLDER_RE = [
  /^\.{2,}$/, /^<[^>]*>$/, /^x{2,}$/i, /^示例/, /^请填/, /^\d+\s*-\s*\d+\s*字/,
];
function isBad(s: unknown, min = 2): boolean {
  if (typeof s !== "string") return true;
  const t = s.trim();
  return t.length < min || PLACEHOLDER_RE.some((re) => re.test(t));
}

const VAGUE_WHOLE_STRINGS: RegExp[] = [
  /^多投简历$/, /^提升能力$/, /^准备面试$/, /^好好学习$/, /^加油$/,
];

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function normalizeOverview(d: Overview, scoring: ScoringResult): Overview {
  d.fourDimRadar = scoring.fourDim.map((dim, i) => ({
    name: dim.name,
    score: dim.score,
    ...(d.fourDimRadar[i]?.conclusion ? { conclusion: d.fourDimRadar[i].conclusion } : {}),
  }));
  if (d.personality?.type) {
    d.personality.type = d.personality.type
      .replace(/^[A-Za-z]{2,6}\s*[·\-:、|/]\s*/, "")
      .replace(/[（(][A-Za-z\s/]{2,12}[）)]/g, "")
      .trim();
  }
  return d;
}

export function normalizeStrength(d: Strength, scoring: ScoringResult): Strength {
  d.abilityRadar = scoring.ability.map((a) => ({ name: a.name, score: a.score }));
  return d;
}

export function normalizePositioning(d: Positioning): Positioning {
  // coreCompetencies 不再被量表分覆写——validator 已经保证形状（5 项、name 非泛化、score 0-100）
  // 这里只做去重、裁剪、clamp、trim
  const normalizeRec = (rec: PositionRecommendation): PositionRecommendation => {
    const rawComps = Array.isArray(rec.coreCompetencies) ? rec.coreCompetencies : [];
    const seen = new Set<string>();
    const comps: { name: string; score: number }[] = [];
    for (const c of rawComps) {
      if (!c || typeof c.name !== "string") continue;
      const name = c.name.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      comps.push({ name, score: clampScore(c.score) });
      if (comps.length >= 5) break;
    }
    return {
      ...rec,
      matchScore: clampScore(rec.matchScore),
      industries: (rec.industries ?? []).map((s) => String(s).trim()).filter(Boolean),
      coreResponsibilities: Array.isArray(rec.coreResponsibilities)
        ? rec.coreResponsibilities.map((r) => String(r).trim()).filter(Boolean)
        : undefined,
      coreCompetencies: comps,
      fitReason:
        typeof rec.fitReason === "string" && rec.fitReason.trim()
          ? rec.fitReason.trim()
          : undefined,
      specialNote:
        typeof rec.specialNote === "string" && rec.specialNote.trim()
          ? rec.specialNote.trim()
          : undefined,
    };
  };
  return { primary: normalizeRec(d.primary), secondary: normalizeRec(d.secondary) };
}

export function normalizeEmploymentIndex(raw: unknown): number {
  const v = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(v)) return 30;
  const clamped = Math.max(10, Math.min(90, Math.round(v)));
  return Math.round(clamped / 5) * 5;
}

export function patchAdvice(d: Advice): Advice {
  const valid = Array.isArray(d.topThree)
    ? d.topThree.filter(
        (item) =>
          item &&
          !isBad(item.title, 4) &&
          !VAGUE_WHOLE_STRINGS.some((re) => re.test(String(item.title))) &&
          !isBad(item.detail, 20) &&
          !isBad(item.deadline, 2),
      )
    : [];
  return { topThree: valid.slice(0, 3) };
}
