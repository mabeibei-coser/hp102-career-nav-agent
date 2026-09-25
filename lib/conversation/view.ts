import { DomainError } from "@/lib/errors";
import { getActiveTask } from "@/lib/db/repositories/career-tasks";
import { listInterviewAnswers } from "@/lib/db/repositories/interview-answers";
import { listMessages, type Message } from "@/lib/db/repositories/messages";
import { listQuizAnswers } from "@/lib/db/repositories/quiz-answers";
import { getConversation } from "@/lib/db/repositories/conversations";
import { getReportByUuid } from "@/lib/db/repositories/reports";
import {
  interviewQuestionCard,
  nextUnansweredInterviewId,
  profileFormCard,
  quizQuestionCard,
  reportCtaCard,
  reportStatusCard,
  type CardPayload,
} from "@/lib/career/cards";
import { showCurrentStep } from "@/lib/career/service";
import { nextUnansweredQuestionId } from "@/lib/career/quiz-bank";
import type { InterviewQuestion, OptionLabel, Stage } from "@/lib/career/types";

export type MessageContent =
  | { kind: "text"; text: string; source?: "chat" | "action" }
  | { kind: "card"; card: CardPayload };

export type ChatMessage = {
  id: string;
  seq: number;
  role: "user" | "assistant" | "notice" | "card";
  content: MessageContent;
  createdAt: number;
};

export type ConversationState = {
  conversationId: string;
  activeTaskId: string;
  stage: Stage;
  activeCardMessageId: string | null;
  quizProgress: { answered: number; total: 8 };
  interviewProgress: { answered: number; total: 4 };
  answersByTask: Record<
    string,
    { quiz: Record<string, OptionLabel>; interview: Record<string, string> }
  >;
  reportUuid: string | null;
  pollAfterMs: number | null;
  fallbackCard: CardPayload | null;
};

function toChatMessage(message: Message): ChatMessage {
  return {
    id: message.id,
    seq: message.seq,
    role: message.role,
    content: message.content as MessageContent,
    createdAt: message.createdAt,
  };
}

function parseInterviewQuestions(json: string | null): InterviewQuestion[] {
  if (!json) return [];
  return JSON.parse(json) as InterviewQuestion[];
}

function computeActiveCardMessageId(
  messages: ChatMessage[],
  taskId: string,
  stage: Stage,
  nextQuizId: string | null,
  nextInterviewId: string | null,
): string | null {
  const cardMessages = messages.filter(
    (m) => m.role === "card" && m.content.kind === "card",
  );
  for (let i = cardMessages.length - 1; i >= 0; i--) {
    const msg = cardMessages[i];
    if (msg.content.kind !== "card") continue;
    const card = msg.content.card;
    if (card.taskId !== taskId) continue;
    switch (stage) {
      case "profile":
        if (card.type === "profile_form") return msg.id;
        break;
      case "quiz":
        if (card.type === "quiz_question" && card.questionId === nextQuizId) {
          return msg.id;
        }
        break;
      case "interview":
        if (
          card.type === "interview_question" &&
          card.questionId === nextInterviewId
        ) {
          return msg.id;
        }
        break;
      case "ready_for_report":
        if (card.type === "login_required") return msg.id;
        if (card.type === "report_cta") return msg.id;
        break;
      case "report_failed":
        if (card.type === "report_status" && card.status === "failed") {
          return msg.id;
        }
        break;
      default:
        break;
    }
  }
  return null;
}

function computeFallbackCard(
  userId: string,
  conversationId: string,
  stage: Stage,
  activeCardMessageId: string | null,
): CardPayload | null {
  if (activeCardMessageId) return null;
  if (
    stage === "report_generating" ||
    stage === "report_ready"
  ) {
    return null;
  }
  if (
    stage === "profile" ||
    stage === "quiz" ||
    stage === "interview" ||
    stage === "ready_for_report" ||
    stage === "report_failed"
  ) {
    try {
      const step = showCurrentStep({ userId, conversationId });
      return step.cards[0] ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export function getConversationView(userId: string, conversationId: string) {
  const conversation = getConversation(userId, conversationId);
  if (!conversation) {
    throw new DomainError("NOT_FOUND");
  }

  const task = getActiveTask(userId, conversationId);
  if (!task) {
    throw new DomainError("NOT_FOUND");
  }

  const messages = listMessages(conversationId).map(toChatMessage);
  const quizAnswers = listQuizAnswers(task.id);
  const interviewAnswers = listInterviewAnswers(task.id);
  const answeredQuizIds = new Set(quizAnswers.map((a) => a.questionId));
  const answeredInterviewIds = new Set(
    interviewAnswers.map((a) => a.questionId),
  );
  const nextQuizId = nextUnansweredQuestionId(answeredQuizIds);
  const nextInterviewId = nextUnansweredInterviewId(answeredInterviewIds);

  const activeCardMessageId = computeActiveCardMessageId(
    messages,
    task.id,
    task.stage,
    nextQuizId,
    nextInterviewId,
  );

  const answersByTask: ConversationState["answersByTask"] = {
    [task.id]: {
      quiz: Object.fromEntries(
        quizAnswers.map((a) => [a.questionId, a.optionLabel]),
      ),
      interview: Object.fromEntries(
        interviewAnswers.map((a) => [a.questionId, a.answerText]),
      ),
    },
  };

  const state: ConversationState = {
    conversationId,
    activeTaskId: task.id,
    stage: task.stage,
    activeCardMessageId,
    quizProgress: { answered: quizAnswers.length, total: 8 },
    interviewProgress: { answered: interviewAnswers.length, total: 4 },
    answersByTask,
    reportUuid: task.latestReportUuid,
    pollAfterMs: task.stage === "report_generating" ? 3000 : null,
    fallbackCard: computeFallbackCard(
      userId,
      conversationId,
      task.stage,
      activeCardMessageId,
    ),
  };

  return { conversation, messages, state };
}

export function getReportSummaryForPrompt(userId: string, reportUuid: string) {
  const report = getReportByUuid(userId, reportUuid);
  if (!report) return null;
  return JSON.parse(report.reportJson);
}
