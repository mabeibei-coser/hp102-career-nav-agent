import {
  missingRequired,
  type ProfileDraft,
  type ProfileField,
} from "./profile";
import {
  QUIZ_QUESTIONS,
  getQuestion,
  nextUnansweredQuestionId,
} from "./quiz-bank";
import { POLE_LABELS } from "./report/tendency";
import type {
  InterviewQuestion,
  InterviewQuestionId,
  OptionLabel,
  QuizDimension,
  ReportData,
} from "./types";

const DIMENSION_ORDER: QuizDimension[] = [
  "personality",
  "workstyle",
  "value",
  "direction",
];

export type CardPayload =
  | {
      type: "profile_form";
      taskId: string;
      draft: ProfileDraft;
      resume: { fileName: string } | null;
      missing: ProfileField[];
    }
  | {
      type: "quiz_question";
      taskId: string;
      questionId: string;
      index: number;
      total: 8;
      text: string;
      options: { label: OptionLabel; text: string }[];
    }
  | {
      type: "interview_question";
      taskId: string;
      questionId: InterviewQuestionId;
      index: number;
      total: 4;
      text: string;
    }
  | { type: "report_cta"; taskId: string }
  | {
      type: "report_status";
      taskId: string;
      jobId: string;
      status: "generating" | "failed";
      errorMessage?: string;
    }
  | {
      type: "report_summary";
      taskId: string;
      reportUuid: string;
      personalityType: string;
      summary: string;
      fourDim: { name: string; score: number; left: string; right: string }[];
      primary: { position: string; fitReason?: string };
      secondary: { position: string };
      topThree: string[];
    }
  | { type: "restart_confirm"; taskId: string }
  | { type: "login_required"; taskId: string };

export function profileFormCard(
  taskId: string,
  draft: ProfileDraft,
  resume: { fileName: string } | null,
): CardPayload {
  return {
    type: "profile_form",
    taskId,
    draft,
    resume,
    missing: missingRequired(draft),
  };
}

export function quizQuestionCard(
  taskId: string,
  questionId: string,
): CardPayload {
  const question = getQuestion(questionId);
  if (!question) throw new Error(`Unknown question ${questionId}`);
  const index = QUIZ_QUESTIONS.findIndex((q) => q.id === questionId) + 1;
  return {
    type: "quiz_question",
    taskId,
    questionId,
    index,
    total: 8,
    text: question.text,
    options: question.options.map((o) => ({ label: o.label, text: o.text })),
  };
}

export function nextUnansweredInterviewId(
  answeredIds: Set<string>,
): InterviewQuestionId | null {
  const order: InterviewQuestionId[] = ["Q1", "Q2", "Q3", "Q4"];
  return order.find((id) => !answeredIds.has(id)) ?? null;
}

export function interviewQuestionCard(
  taskId: string,
  questionId: InterviewQuestionId,
  questions: InterviewQuestion[],
): CardPayload {
  const question = questions.find((q) => q.id === questionId);
  if (!question) throw new Error(`Unknown interview question ${questionId}`);
  const index = questions.findIndex((q) => q.id === questionId) + 1;
  return {
    type: "interview_question",
    taskId,
    questionId,
    index,
    total: 4,
    text: question.text,
  };
}

export function reportCtaCard(taskId: string): CardPayload {
  return { type: "report_cta", taskId };
}

export function reportStatusCard(
  taskId: string,
  jobId: string,
  status: "generating" | "failed",
  errorMessage?: string,
): CardPayload {
  return {
    type: "report_status",
    taskId,
    jobId,
    status,
    errorMessage,
  };
}

export function reportSummaryCard(
  taskId: string,
  reportUuid: string,
  report: ReportData,
  poleLabels: typeof POLE_LABELS = POLE_LABELS,
): CardPayload {
  const fourDim = report.overview.fourDimRadar.map((item, i) => {
    const dim =
      report.meta.scoring.fourDim[i]?.dimension ?? DIMENSION_ORDER[i];
    const labels = dim ? poleLabels[dim] : { left: "", right: "" };
    return {
      name: item.name,
      score: item.score,
      left: labels.left,
      right: labels.right,
    };
  });
  return {
    type: "report_summary",
    taskId,
    reportUuid,
    personalityType: report.overview.personality.type,
    summary: report.overview.summary,
    fourDim,
    primary: {
      position: report.positioning.primary.position,
      fitReason: report.positioning.primary.fitReason,
    },
    secondary: { position: report.positioning.secondary.position },
    topThree: report.advice.topThree.map((a) => a.title),
  };
}

export function restartConfirmCard(taskId: string): CardPayload {
  return { type: "restart_confirm", taskId };
}

export function loginRequiredCard(taskId: string): CardPayload {
  return { type: "login_required", taskId };
}

export { nextUnansweredQuestionId };
