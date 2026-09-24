import type {
  Advice,
  Overview,
  PositionRecommendation,
  Positioning,
  ResumeDiagnosis,
  ScoringResult,
  Strength,
} from "../types";
import {
  collectAllOverviewText,
  detectReverseWords,
  POLE_KEYWORDS,
  REVERSE_WORD_ISSUE_PREFIX,
  tendencyChip,
} from "./tendency";
import { findRedlineWords } from "./redline";

const PLACEHOLDER_RE = [
  /^\.{2,}$/, /^<[^>]*>$/, /^x{2,}$/i, /^示例/, /^请填/, /^\d+\s*-\s*\d+\s*字/,
];
function isBad(s: unknown, min = 2): boolean {
  if (typeof s !== "string") return true;
  const t = s.trim();
  return t.length < min || PLACEHOLDER_RE.some((re) => re.test(t));
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function numClamp(n: number, lo: number, hi: number) {
  return !Number.isFinite(n) ? lo : Math.min(Math.max(n, lo), hi);
}

const ABILITY_NAMES = ["沟通表达", "协作意识", "执行落地", "学习能力", "信息处理", "压力适应"];

const PRIORITY_VALUES = ["high", "medium", "low"] as const;
type Priority = (typeof PRIORITY_VALUES)[number];
function isPriority(v: unknown): v is Priority {
  return typeof v === "string" && (PRIORITY_VALUES as readonly string[]).includes(v);
}

const VAGUE_WHOLE_STRINGS: RegExp[] = [
  /^多投简历$/, /^提升能力$/, /^准备面试$/, /^好好学习$/, /^加油$/,
];

// ============================================================
// 响应类型
// ============================================================

export interface AllSections {
  overview: Overview;
  strength: Strength;
  positioning: Positioning;
  resumeDiagnosis: ResumeDiagnosis | null;
  advice: Advice;
  /**
   * 就业指数（0-100，5 的倍数）— admin 后台专用，C 端不展示。
   * AI 综合背景/能力/经验/期望合理性给出一个就业帮扶难度评估：
   * 90 极易（背景好+能力强+经验足+期望合理），10 极难（反之），一般 30-60，从严打分。
   */
  employmentIndex: number;
}

export const REDLINE_ISSUE_PREFIX = "redline";
export const ADVICE_COUNT_ISSUE = "advice-topThree-不足3条";

function validateOverviewShape(d: Overview): string | null {
  if (!d?.personality) return "overview.personality 缺失";
  if (isBad(d.personality.type, 2)) return "overview.personality.type 占位符";
  if (
    !Array.isArray(d.personality.traits) ||
    d.personality.traits.length < 3 ||
    d.personality.traits.some((t) => isBad(t, 2))
  )
    return "overview.traits 缺失或不足 3 项";
  if (isBad(d.personality.description, 30)) return "overview.description 过短";
  if (!Array.isArray(d.fourDimRadar) || d.fourDimRadar.length !== 4)
    return "overview.fourDimRadar 必须 4 项";
  if (isBad(d.summary, 50)) return "overview.summary 过短";
  return null;
}

function validateStrength(d: Strength): string | null {
  if (!Array.isArray(d?.abilityRadar) || d.abilityRadar.length !== 6)
    return "strength.abilityRadar 必须 6 项";
  if (!Array.isArray(d.strengths) || d.strengths.length < 3) return "strength.strengths 至少 3 条";
  for (const s of d.strengths)
    if (!s || isBad(s.title) || isBad(s.detail, 20)) return "strength.strengths 条目缺失";
  if (!Array.isArray(d.growth) || d.growth.length < 2) return "strength.growth 至少 2 条";
  for (const g of d.growth)
    if (!g || isBad(g.title) || isBad(g.detail, 20)) return "strength.growth 条目缺失";
  return null;
}

// 6 个量表泛化标签——positioning.coreCompetencies.name 不允许直接使用
const GENERIC_ABILITY_TAGS = new Set([
  "沟通表达", "协作意识", "执行落地", "学习能力", "信息处理", "压力适应",
]);

function validatePositionRec(
  rec: PositionRecommendation | undefined,
  label: string
): string | null {
  if (!rec || typeof rec !== "object") return `${label} 缺失`;
  if (isBad(rec.position, 2)) return `${label}.position 缺失`;
  if (typeof rec.matchScore !== "number" || !Number.isFinite(rec.matchScore))
    return `${label}.matchScore 非数字`;
  if (isBad(rec.culture, 4)) return `${label}.culture 缺失`;
  if (isBad(rec.teamRole, 2)) return `${label}.teamRole 缺失`;

  // 核心能力雷达：必须 5 项，name 按岗位定制（禁泛化标签），score 0-100 数字
  if (!Array.isArray(rec.coreCompetencies) || rec.coreCompetencies.length < 5)
    return `${label}.coreCompetencies 必须 5 项`;
  const seen = new Set<string>();
  for (const c of rec.coreCompetencies.slice(0, 5)) {
    if (!c || typeof c.name !== "string" || !c.name.trim())
      return `${label}.coreCompetencies.name 缺失`;
    const name = c.name.trim();
    // 「泛化标签 / 重复 name」是内容质量（命名够不够岗位定制），不是结构问题：
    // 讯飞常用「沟通表达」等泛化词、偶有重名，硬拒收会触发 retry → 超时 → 掉 mock。
    // 降级为只 warn；name 非空 / 数量 5 项 / score 合法 这些结构硬校验保留。
    if (GENERIC_ABILITY_TAGS.has(name))
      console.warn(`[positioning-competency] ${label}.coreCompetencies 用了泛化标签「${name}」（不拒收，仅记录）`);
    else if (seen.has(name))
      console.warn(`[positioning-competency] ${label}.coreCompetencies 出现重复 name「${name}」（不拒收，仅记录）`);
    seen.add(name);
    if (typeof c.score !== "number" || !Number.isFinite(c.score) || c.score < 0 || c.score > 100)
      return `${label}.coreCompetencies.score 非法（${String(c.score)}）`;
  }
  return null;
}

const POSITIONING_WATERLINE_ISSUE_PREFIX = "positioning-waterline";

function validatePositioningWaterline(d: Positioning): string | null {
  const issues: string[] = [];
  // 整体偏「合适」：均值 ≥ 70，至少 1 项 ≤ 70（明显短板），primary/secondary 重叠 ≤ 2
  for (const [label, rec] of [["primary", d.primary], ["secondary", d.secondary]] as const) {
    const scores = (rec.coreCompetencies ?? []).slice(0, 5).map((c) => c.score);
    if (scores.length < 5) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 70) issues.push(`${label} 均值 ${avg.toFixed(1)} 偏低（应 ≥ 72）`);
    if (!scores.some((s) => s <= 70))
      issues.push(`${label} 缺少明显短板项（应至少 1 项 ≤ 70 用于诚恳指出不足）`);
  }
  const pNames = new Set((d.primary.coreCompetencies ?? []).slice(0, 5).map((c) => c.name.trim()));
  const sNames = (d.secondary.coreCompetencies ?? []).slice(0, 5).map((c) => c.name.trim());
  const overlap = sNames.filter((n) => pNames.has(n)).length;
  if (overlap > 2)
    issues.push(`primary/secondary coreCompetencies 重叠 ${overlap} 项（应 ≤ 2）`);
  return issues.length === 0 ? null : `${POSITIONING_WATERLINE_ISSUE_PREFIX}: ${issues.join("; ")}`;
}

function validatePositioning(d: Positioning): string | null {
  const p = validatePositionRec(d?.primary, "positioning.primary");
  if (p) return p;
  const s = validatePositionRec(d?.secondary, "positioning.secondary");
  if (s) return s;
  const w = validatePositioningWaterline(d);
  // 水位质检（均值≥70 + 至少 1 项≤70）降级为只 warn、不再拒收：这两个条件互相打架、
  // 窄窗口，讯飞带随机性难稳定凑齐；凑不齐就废掉整份报告 → 同链路 retry → retry 超时
  // （Request aborted）→ 两链路都失败 → 静默掉 mock（社保局演示翻车根因）。
  // 报告可用性不依赖该分数水位；coreCompetencies 的形状校验已在 validatePositionRec 保留。
  if (w) console.warn("[positioning-waterline] 软提示（不拒收，仅记录）:", w);
  return null;
}

function validateResumeDiagnosis(data: ResumeDiagnosis): string | null {
  if (!data || typeof data !== "object") return "resumeDiagnosis 不是对象";
  if (typeof data.overallScore !== "number") return "resumeDiagnosis.overallScore 不是数字";
  data.overallScore = Math.round(numClamp(data.overallScore, 0, 100));
  if (!Array.isArray(data.issues) || data.issues.length === 0) return "resumeDiagnosis.issues 为空";
  if (data.issues.length > 4) data.issues = data.issues.slice(0, 4);
  for (const it of data.issues) {
    if (!it || typeof it.title !== "string" || !it.title.trim()) return "resumeDiagnosis.issue.title 缺失";
    if (typeof it.detail !== "string" || !it.detail.trim()) return "resumeDiagnosis.issue.detail 缺失";
    if (!isPriority(it.priority)) return `resumeDiagnosis.issue.priority 非法: ${String(it.priority)}`;
  }
  if (!Array.isArray(data.suggestions) || data.suggestions.length < 2)
    return "resumeDiagnosis.suggestions 不足 2 条";
  if (data.suggestions.length > 4) data.suggestions = data.suggestions.slice(0, 4);
  for (const s of data.suggestions) {
    if (typeof s.title !== "string" || !s.title.trim()) return "resumeDiagnosis.suggestion.title 缺失";
    if (typeof s.detail !== "string" || !s.detail.trim()) return "resumeDiagnosis.suggestion.detail 缺失";
  }
  return null;
}

function validateAdvice(d: Advice): string | null {
  if (!d || !Array.isArray(d.topThree)) return "advice.topThree 缺失";
  return null;
}

/**
 * 大调用 validator：5 模块全做形状校验 + overview 全字段反向词校验。
 * scoring 闭包传入，给反向词检测用；retry hook 拿到 issue 字符串后用前缀判断要不要喂回 LLM。
 */
function buildAllValidator(hasResume: boolean, scoring: ScoringResult) {
  return (d: AllSections): string | null => {
    const oErr = validateOverviewShape(d.overview);
    if (oErr) return oErr;
    const sErr = validateStrength(d.strength);
    if (sErr) return sErr;
    const pErr = validatePositioning(d.positioning);
    if (pErr) return pErr;
    if (hasResume) {
      if (d.resumeDiagnosis === null) return "hasResume=true 但 resumeDiagnosis 为 null";
      const rErr = validateResumeDiagnosis(d.resumeDiagnosis);
      if (rErr) return rErr;
    }
    // 无简历时 resumeDiagnosis 应为 null，不校验
    const aErr = validateAdvice(d.advice);
    if (aErr) return aErr;

    // employmentIndex 形状（5 倍数 + 10-90 范围）软校验：偏差 normalize 兜底，不触发整份报告 retry。
    // 整份报告内容是合格的，仅就业指数离谱犯不上掉 mock。
    if (typeof d.employmentIndex !== "number" || !Number.isFinite(d.employmentIndex)) {
      console.warn(`[employment-index] 缺失或非数字（${String(d.employmentIndex)}），将兜底成 30`);
    } else if (d.employmentIndex % 5 !== 0 || d.employmentIndex < 10 || d.employmentIndex > 90) {
      console.warn(`[employment-index] 非法值 ${d.employmentIndex}（应是 10-90 的 5 倍数），将 clamp 修正`);
    }

    // 全字段反向词质检（type + traits + description + 4 conclusion + summary）。
    // 这属于内容质量检查，不应把结构完整的真实报告整份打成 mock。
    const text = collectAllOverviewText(d.overview);
    const conflicts = detectReverseWords(text, scoring.fourDim);
    if (conflicts.length > 0) {
      const summary = conflicts
        .map((c) => {
          const side = c.tendency === "left" ? "偏左" : "偏右";
          const dimScore = scoring.fourDim.find((x) => x.dimension === c.dimension)!;
          return `${c.dimensionName}（${side}：${tendencyChip(dimScore.score, c.dimension)}）出现反向核心词 [${c.hits.join("、")}]`;
        })
        .join("; ");
      console.warn("[overview-reverse-word] 软提示（不拒收，仅记录）:", summary);
    }
    return null;
  };
}

/**
 * 反向词冲突 retry 钩子：把违规字段 + 应呼应方向喂回 LLM，同链路重试一次。
 * 仅在反向词冲突时触发；形状校验失败不重试（重试同 prompt 没意义）。
 */
function buildOnValidationFailure(
  scoring: ScoringResult,
  userPrompt: string
) {
  return (issue: string, data: AllSections): { user: string } | null => {
    // 分支 1：positioning coreCompetencies 水位修正
    if (issue.startsWith(POSITIONING_WATERLINE_ISSUE_PREFIX)) {
      const dumpRec = (label: string, rec: PositionRecommendation | undefined) => {
        const items = (rec?.coreCompetencies ?? [])
          .slice(0, 5)
          .map((c) => `${c.name}=${c.score}`)
          .join(", ");
        return `  ${label}（${rec?.position ?? "?"}）: [${items}]`;
      };
      const feedback = [
        "",
        "═══ 上一轮 positioning.coreCompetencies 水位不达标，必须修正后重新生成完整 JSON ═══",
        `问题：${issue.replace(POSITIONING_WATERLINE_ISSUE_PREFIX + ": ", "")}`,
        "上一轮输出：",
        dumpRec("primary", data.positioning?.primary),
        dumpRec("secondary", data.positioning?.secondary),
        "",
        "【修正方向】整体偏「合适」 + 诚恳指出不足：",
        "- 5 项分数均值 ≥ 72（让用户感觉基本胜任）",
        "- 3-4 项落 75-90 区间（擅长 / 较擅长）",
        "- 至少 1 项落 55-70（短板，必须在 fitReason / specialNote 里点名提到并给可执行建议）",
        "- primary 与 secondary 至少 3 项 name 不同",
        "",
        "请重新输出完整 5 模块 JSON：positioning 严格按上述水位重写；其他模块保持上一轮内容（如果一致就照搬）。不要解释，直接输出新 JSON。",
      ].join("\n");
      return { user: userPrompt + feedback };
    }

    // 分支 2：overview 反向词冲突修正
    if (!issue.startsWith(REVERSE_WORD_ISSUE_PREFIX)) return null;
    const text = collectAllOverviewText(data.overview);
    const conflicts = detectReverseWords(text, scoring.fourDim);
    if (conflicts.length === 0) return null;

    const fixLines = conflicts.map((c) => {
      const dimScore = scoring.fourDim.find((x) => x.dimension === c.dimension)!;
      const chip = tendencyChip(dimScore.score, c.dimension);
      const dict = POLE_KEYWORDS[c.dimension];
      const avoid = (c.tendency === "left" ? dict.right : dict.left).join("、");
      const echo = (c.tendency === "left" ? dict.left : dict.right).slice(0, 4).join("、");
      return `- ${c.dimensionName}（${chip}，分数 ${dimScore.score}）：上次输出含反向词 [${c.hits.join("、")}]。**严禁** "${avoid}"；**应呼应** "${echo}" 等方向词`;
    });

    const conclusions = Array.isArray(data.overview?.fourDimRadar)
      ? data.overview.fourDimRadar
          .map((r, i) => `  [${i}] ${r?.name ?? ""}: ${r?.conclusion ?? ""}`)
          .join("\n")
      : "";

    const feedback = [
      "",
      "═══ 上一轮 overview 输出存在逻辑反向问题，必须修正后重新生成完整 JSON ═══",
      `上一轮 personality.type = "${data.overview?.personality?.type ?? ""}"`,
      `上一轮 traits = ${JSON.stringify(data.overview?.personality?.traits ?? [])}`,
      `上一轮 personality.description = "${data.overview?.personality?.description ?? ""}"`,
      `上一轮 fourDimRadar.conclusion:`,
      conclusions,
      `上一轮 summary = "${data.overview?.summary ?? ""}"`,
      "",
      "【冲突清单 + 修正方向】",
      ...fixLines,
      "",
      "请重新输出完整 5 模块 JSON：overview 的 type / traits / description / 4 个 conclusion / summary **全部**按上述方向重写；strength / positioning / resumeDiagnosis / advice 跟着 overview 新的性格定位重写一致版本。所有 score 数值不变。不要解释，直接输出新 JSON。",
    ].join("\n");

    return { user: userPrompt + feedback };
  };
}

function countValidTopThree(d: Advice): number {
  if (!Array.isArray(d?.topThree)) return 0;
  return d.topThree.filter(
    (item) =>
      item &&
      !isBad(item.title, 4) &&
      !VAGUE_WHOLE_STRINGS.some((re) => re.test(String(item.title))) &&
      !isBad(item.detail, 20) &&
      !isBad(item.deadline, 2),
  ).length;
}

export function buildReportValidator(hasResume: boolean, scoring: ScoringResult) {
  const base = buildAllValidator(hasResume, scoring);
  return (d: AllSections): string | null => {
    const baseIssue = base(d);
    if (baseIssue) return baseIssue;
    if (countValidTopThree(d.advice) < 3) return ADVICE_COUNT_ISSUE;
    const hits = findRedlineWords(JSON.stringify(d));
    if (hits.length > 0) return `${REDLINE_ISSUE_PREFIX}: ${hits.join("、")}`;
    return null;
  };
}

export function buildReportRetryHook(scoring: ScoringResult, userPrompt: string) {
  const base = buildOnValidationFailure(scoring, userPrompt);
  return (issue: string, data: AllSections) => {
    if (issue.startsWith(REDLINE_ISSUE_PREFIX)) {
      return {
        user:
          userPrompt +
          `\n\n═══ 上一轮输出包含禁用词：${issue.slice(REDLINE_ISSUE_PREFIX.length + 2)}。请重新输出完整 5 模块 JSON，确保完全不出现这些词，其他内容尽量保持不变。不要解释，直接输出新 JSON。═══`,
      };
    }
    return base(issue, data);
  };
}
