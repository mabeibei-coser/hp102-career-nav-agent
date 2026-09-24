// ========== 表单输入类型 ==========

/**
 * 包含新老两套 enum 的宽 union — DB / prompt 分支需要识别全部值。
 * 表单当前只让填 recent_grad / general_job_seeker，见 ActiveUserIdentity。
 */
export type UserIdentity =
  | "recent_grad"
  | "general_job_seeker"
  | "young_unemployed"
  | "general_unemployed";

export type ActiveUserIdentity = "recent_grad" | "general_job_seeker";

export interface JobFormData {
  identity: UserIdentity;
  /** 从简历正文启发式抽取的姓名（admin 后台展示用） */
  name?: string;
  /** 从简历正文启发式抽取的中国大陆手机号（admin 后台展示用） */
  phone?: string;
  /** 出生年月，格式 "YYYY-MM"（来自 <input type="month">）；admin 后台据此算年龄。 */
  birthDate?: string;
  targetPosition: string;
  education: string;
  workYears: string;
  resumeText?: string;
  resumeFileName?: string;
}

export type Stage =
  | "profile"
  | "quiz"
  | "interview"
  | "ready_for_report"
  | "report_generating"
  | "report_ready"
  | "report_failed";

export type OptionLabel = "A" | "B" | "C" | "D";

// ========== 量表测评类型 ==========

export type QuizDimension = "personality" | "workstyle" | "value" | "direction";

export const QUIZ_DIMENSION_NAMES: Record<QuizDimension, string> = {
  personality: "性格底色",
  workstyle: "工作风格",
  value: "价值驱动",
  direction: "适配方向",
};

export type AbilityKey =
  | "communication"
  | "collaboration"
  | "execution"
  | "learning"
  | "data"
  | "stress";

export const ABILITY_NAMES: Record<AbilityKey, string> = {
  communication: "沟通表达",
  collaboration: "协作意识",
  execution: "执行落地",
  learning: "学习能力",
  data: "信息处理",
  stress: "压力适应",
};

export interface QuizOption {
  label: OptionLabel;
  text: string;
  poleValue?: number;
  weights: Partial<Record<AbilityKey, number>>;
}

export interface QuizQuestion {
  id: string;
  dimension?: QuizDimension;
  text: string;
  options: QuizOption[];
}

export interface QuizBank {
  version: string;
  fixedQuestions: QuizQuestion[];
}

export interface QuizAnswer {
  questionId: string;
  selectedLabel: OptionLabel;
}

export interface DimensionScore {
  dimension: QuizDimension;
  name: string;
  score: number;
}

export interface AbilityScore {
  key: AbilityKey;
  name: string;
  score: number;
}

export interface ScoringResult {
  fourDim: DimensionScore[];
  ability: AbilityScore[];
}

// ========== 访谈类型 ==========

export type InterviewQuestionId = "Q1" | "Q2" | "Q3" | "Q4";

export interface InterviewQuestion {
  id: InterviewQuestionId;
  text: string;
  source: "dynamic" | "dynamic_fallback" | "fixed";
}

export interface InterviewAnswer {
  questionId: InterviewQuestionId;
  text: string;
  inputMethod: "voice" | "text";
  audioDurationSec?: number;
}

export interface InterviewQ1Q2 {
  Q1?: string;
  Q2?: string;
}

export interface InterviewQ3Q4 {
  Q3?: string;
  Q4?: string;
}

// ========== 报告类型 ==========

export type ReportSectionKey =
  | "overview"
  | "strength"
  | "positioning"
  | "resumeDiagnosis"
  | "advice";

export interface ReportMeta {
  generatedAt: string;
  formData: JobFormData;
  scoring: ScoringResult;
  hasResume: boolean;
  interviewQ1Q2: InterviewQ1Q2;
}

export interface Overview {
  personality: {
    type: string;
    traits: string[];
    description: string;
  };
  fourDimRadar: {
    name: string;
    score: number;
    conclusion?: string;
  }[];
  summary: string;
}

export interface Strength {
  abilityRadar: {
    name: string;
    score: number;
  }[];
  strengths: {
    title: string;
    detail: string;
  }[];
  growth: {
    title: string;
    detail: string;
  }[];
}

export interface PositionRecommendation {
  position: string;
  matchScore: number;
  reasoning: string;
  industries: string[];
  culture: string;
  teamRole: string;
  coreResponsibilities?: string[];
  coreCompetencies?: { name: string; score: number }[];
  fitReason?: string;
  specialNote?: string;
}

export interface Positioning {
  primary: PositionRecommendation;
  secondary: PositionRecommendation;
}

export interface ResumeDiagnosis {
  overallScore: number;
  issues: {
    title: string;
    detail: string;
    priority: "high" | "medium" | "low";
    quotedSnippet?: string;
    revisionExample?: string;
  }[];
  suggestions: {
    title: string;
    detail: string;
  }[];
}

export interface Advice {
  topThree: {
    title: string;
    detail: string;
    deadline: string;
  }[];
}

export interface ReportData {
  meta: ReportMeta;
  overview: Overview;
  strength: Strength;
  positioning: Positioning;
  resumeDiagnosis: ResumeDiagnosis | null;
  advice: Advice;
  employmentIndex?: number;
}
