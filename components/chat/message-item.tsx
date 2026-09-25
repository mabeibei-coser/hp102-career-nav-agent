"use client";

import type { CardPayload } from "@/lib/career/cards";
import type { ProfileInput } from "@/lib/career/profile";
import type { OptionLabel } from "@/lib/career/types";
import type { ChatMessage, ConversationState } from "@/lib/conversation/view";
import { ProfileFormCardView } from "@/components/cards/profile-form-card";
import { QuizQuestionCardView } from "@/components/cards/quiz-question-card";
import { InterviewQuestionCardView } from "@/components/cards/interview-question-card";
import { ReportCtaCardView } from "@/components/cards/report-cta-card";
import { ReportStatusCardView } from "@/components/cards/report-status-card";
import { ReportSummaryCardView } from "@/components/cards/report-summary-card";
import { LoginCardView } from "@/components/cards/login-card";
import { RestartConfirmCardView } from "@/components/cards/restart-confirm-card";

export type ChatAction =
  | { type: "confirm_profile"; taskId: string; profile: ProfileInput }
  | {
      type: "answer_quiz";
      taskId: string;
      questionId: string;
      optionLabel: OptionLabel;
    }
  | {
      type: "answer_interview";
      taskId: string;
      questionId: string;
      text: string;
      inputMethod?: "card" | "voice";
    }
  | { type: "generate_report"; taskId: string }
  | { type: "confirm_restart"; taskId: string }
  | { type: "cancel_restart"; taskId: string };

type MessageItemProps = {
  message: ChatMessage;
  messages: ChatMessage[];
  state: ConversationState;
  disabled?: boolean;
  loadingAction?: boolean;
  onAction: (action: ChatAction) => void;
  onUploadResume: (file: File) => void;
  fallbackCard?: CardPayload | null;
};

function isRestartConfirmActive(
  card: CardPayload,
  state: ConversationState,
): boolean {
  return (
    card.type === "restart_confirm" &&
    card.taskId === state.activeTaskId &&
    state.stage !== "profile" &&
    state.stage !== "report_generating"
  );
}

function hasActiveRestartConfirm(
  messages: ChatMessage[],
  state: ConversationState,
): boolean {
  return messages.some(
    (m) =>
      m.role === "card" &&
      m.content.kind === "card" &&
      isRestartConfirmActive(m.content.card, state),
  );
}

function isActiveCard(
  message: ChatMessage,
  messages: ChatMessage[],
  state: ConversationState,
  fallbackCard: CardPayload | null | undefined,
): boolean {
  if (message.content.kind !== "card") return false;
  const card = message.content.card;

  if (isRestartConfirmActive(card, state)) return true;

  if (hasActiveRestartConfirm(messages, state)) return false;

  if (message.id === state.activeCardMessageId) return true;
  if (
    !state.activeCardMessageId &&
    fallbackCard &&
    card.type === fallbackCard.type
  ) {
    return true;
  }
  return false;
}

function TextBubble({
  text,
  align,
}: {
  text: string;
  align: "left" | "right";
}) {
  const isUser = align === "right";
  return (
    <div className={`flex px-4 py-1 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-base ${
          isUser
            ? "rounded-br-sm bg-blue-600 text-white"
            : "rounded-bl-sm bg-gray-100 text-gray-900"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function CardRenderer({
  card,
  active,
  state,
  disabled,
  loadingAction,
  onAction,
  onUploadResume,
}: {
  card: CardPayload;
  active: boolean;
  state: ConversationState;
  disabled?: boolean;
  loadingAction?: boolean;
  onAction: (action: ChatAction) => void;
  onUploadResume: (file: File) => void;
}) {
  const answers = state.answersByTask[card.taskId];

  switch (card.type) {
    case "profile_form":
      return (
        <ProfileFormCardView
          key={`${card.taskId}-${card.resume?.fileName ?? ""}-${card.draft.education ?? ""}`}
          card={card}
          active={active}
          disabled={disabled}
          loadingAction={loadingAction}
          onConfirm={(profile) =>
            onAction({ type: "confirm_profile", taskId: card.taskId, profile })
          }
          onUploadResume={onUploadResume}
        />
      );
    case "quiz_question":
      return (
        <QuizQuestionCardView
          card={card}
          active={active}
          disabled={disabled}
          loadingAction={loadingAction}
          selectedLabel={answers?.quiz[card.questionId]}
          onAnswer={(optionLabel) =>
            onAction({
              type: "answer_quiz",
              taskId: card.taskId,
              questionId: card.questionId,
              optionLabel,
            })
          }
        />
      );
    case "interview_question":
      return (
        <InterviewQuestionCardView
          card={card}
          active={active}
          disabled={disabled}
          loadingAction={loadingAction}
          answeredText={answers?.interview[card.questionId]}
          onSubmit={(text, inputMethod) =>
            onAction({
              type: "answer_interview",
              taskId: card.taskId,
              questionId: card.questionId,
              text,
              inputMethod: inputMethod ?? "card",
            })
          }
        />
      );
    case "report_cta":
      return (
        <ReportCtaCardView
          card={card}
          active={active}
          disabled={disabled}
          loadingAction={loadingAction}
          onGenerate={() =>
            onAction({ type: "generate_report", taskId: card.taskId })
          }
        />
      );
    case "report_status":
      return (
        <ReportStatusCardView
          card={card}
          active={active}
          disabled={disabled}
          loadingAction={loadingAction}
          onRetry={() =>
            onAction({ type: "generate_report", taskId: card.taskId })
          }
        />
      );
    case "report_summary":
      return <ReportSummaryCardView card={card} />;
    case "restart_confirm":
      return (
        <RestartConfirmCardView
          card={card}
          active={active}
          disabled={disabled}
          loadingAction={loadingAction}
          onConfirm={() =>
            onAction({ type: "confirm_restart", taskId: card.taskId })
          }
          onCancel={() =>
            onAction({ type: "cancel_restart", taskId: card.taskId })
          }
        />
      );
    case "login_required":
      return (
        <LoginCardView
          card={card}
          active={active}
          disabled={disabled}
          onLoggedIn={() =>
            onAction({ type: "generate_report", taskId: card.taskId })
          }
        />
      );
    default:
      return (
        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          [卡片：unknown]
        </div>
      );
  }
}

export function MessageItem({
  message,
  messages,
  state,
  disabled,
  loadingAction,
  onAction,
  onUploadResume,
  fallbackCard,
}: MessageItemProps) {
  if (message.role === "user" || message.role === "assistant" || message.role === "notice") {
    const text =
      message.content.kind === "text" ? message.content.text : "";
    const align = message.role === "user" ? "right" : "left";
    return <TextBubble text={text} align={align} />;
  }

  if (message.role === "card" && message.content.kind === "card") {
    const active = isActiveCard(message, messages, state, fallbackCard);
    return (
      <div className="px-4 py-2">
        <CardRenderer
          card={message.content.card}
          active={active}
          state={state}
          disabled={disabled}
          loadingAction={loadingAction}
          onAction={onAction}
          onUploadResume={onUploadResume}
        />
      </div>
    );
  }

  return null;
}

export function FallbackCardItem({
  card,
  state,
  disabled,
  loadingAction,
  onAction,
  onUploadResume,
}: {
  card: CardPayload;
  state: ConversationState;
  disabled?: boolean;
  loadingAction?: boolean;
  onAction: (action: ChatAction) => void;
  onUploadResume: (file: File) => void;
}) {
  return (
    <div className="px-4 py-2">
      <CardRenderer
        card={card}
        active={true}
        state={state}
        disabled={disabled}
        loadingAction={loadingAction}
        onAction={onAction}
        onUploadResume={onUploadResume}
      />
    </div>
  );
}
