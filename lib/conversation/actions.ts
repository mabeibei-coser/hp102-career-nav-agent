import { z } from "zod";
import { DomainError } from "@/lib/errors";
import { withTransaction } from "@/lib/db/client";
import { getActiveTask } from "@/lib/db/repositories/career-tasks";
import { insertMessages } from "@/lib/db/repositories/messages";
import {
  answerInterview,
  answerQuiz,
  cancelRestart,
  confirmProfile,
  confirmRestart,
  requestReport,
  type Actor,
  type StepResult,
} from "@/lib/career/service";
import {
  labelOfEducation,
  labelOfIdentity,
  labelOfWorkYears,
  profileInputSchema,
} from "@/lib/career/profile";
import { QUIZ_QUESTION_IDS } from "@/lib/career/quiz-bank";
import { ACTIONS_BY_STAGE } from "@/lib/career/stages";
import { getQuestion } from "@/lib/career/quiz-bank";
import { withConversationLock } from "./lock";
import type { CardPayload } from "@/lib/career/cards";
import { getConversationView, type ChatMessage } from "./view";

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("confirm_profile"),
    taskId: z.string().uuid(),
    profile: profileInputSchema,
  }),
  z.object({
    type: z.literal("answer_quiz"),
    taskId: z.string().uuid(),
    questionId: z.enum(QUIZ_QUESTION_IDS),
    optionLabel: z.enum(["A", "B", "C", "D"]),
  }),
  z.object({
    type: z.literal("answer_interview"),
    taskId: z.string().uuid(),
    questionId: z.enum(["Q1", "Q2", "Q3", "Q4"]),
    text: z.string(),
    inputMethod: z.enum(["card", "voice"]).default("card"),
  }),
  z.object({
    type: z.literal("generate_report"),
    taskId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("confirm_restart"),
    taskId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("cancel_restart"),
    taskId: z.string().uuid(),
  }),
]);

export type ActionInput = z.infer<typeof actionSchema>;

function actionUserMessage(action: ActionInput): { role: "user"; content: MessageContent } {
  switch (action.type) {
    case "confirm_profile": {
      const p = action.profile;
      const target = p.targetPosition?.trim()
        ? ` · 目标：${p.targetPosition}`
        : "";
      const text = `（确认档案）${labelOfIdentity(p.identity)} · ${labelOfEducation(p.education)} · ${p.birthDate} · ${labelOfWorkYears(p.workYears)}${target}`;
      return { role: "user", content: { kind: "text", text, source: "action" } };
    }
    case "answer_quiz": {
      const q = getQuestion(action.questionId);
      const option = q?.options.find((o) => o.label === action.optionLabel);
      const index = QUIZ_QUESTION_IDS.indexOf(action.questionId) + 1;
      const text = `（第 ${index} 题）${action.optionLabel}. ${option?.text ?? ""}`;
      return { role: "user", content: { kind: "text", text, source: "action" } };
    }
    case "answer_interview":
      return {
        role: "user",
        content: { kind: "text", text: action.text, source: "action" },
      };
    case "generate_report":
      return {
        role: "user",
        content: { kind: "text", text: "（生成报告）", source: "action" },
      };
    case "confirm_restart":
      return {
        role: "user",
        content: { kind: "text", text: "（确认重新开始）", source: "action" },
      };
    case "cancel_restart":
      return {
        role: "user",
        content: { kind: "text", text: "（继续当前进度）", source: "action" },
      };
  }
}

type MessageContent =
  | { kind: "text"; text: string; source?: "chat" | "action" }
  | { kind: "card"; card: CardPayload };

function stepToMessages(
  userMsg: { role: "user"; content: MessageContent },
  result: StepResult,
): Array<{ role: "user" | "assistant" | "notice" | "card"; content: MessageContent }> {
  const items: Array<{
    role: "user" | "assistant" | "notice" | "card";
    content: MessageContent;
  }> = [userMsg];
  for (const notice of result.notices) {
    items.push({ role: "notice", content: { kind: "text", text: notice } });
  }
  for (const card of result.cards) {
    items.push({ role: "card", content: { kind: "card", card } });
  }
  return items;
}

export async function handleAction(
  actor: Actor,
  actionInput: unknown,
  meta?: { ip?: string; userAgent?: string },
): Promise<{ messages: ChatMessage[]; state: ReturnType<typeof getConversationView>["state"]; jobId?: string }> {
  return withConversationLock(actor.conversationId, async () => {
    const action = actionSchema.parse(actionInput);
    const task = getActiveTask(actor.userId, actor.conversationId);
    if (!task || task.id !== action.taskId) {
      throw new DomainError("STAGE_MISMATCH");
    }
    if (!ACTIONS_BY_STAGE[task.stage].includes(action.type)) {
      throw new DomainError("STAGE_MISMATCH");
    }

    let result: StepResult;
    switch (action.type) {
      case "confirm_profile":
        result = confirmProfile(actor, action.profile);
        break;
      case "answer_quiz":
        result = await answerQuiz(actor, {
          questionId: action.questionId,
          optionLabel: action.optionLabel,
          inputMethod: "button",
        });
        break;
      case "answer_interview":
        result = answerInterview(actor, {
          questionId: action.questionId,
          text: action.text,
          inputMethod: action.inputMethod,
        });
        break;
      case "generate_report":
        result = requestReport(actor, meta ?? {});
        break;
      case "confirm_restart":
        result = confirmRestart(actor);
        break;
      case "cancel_restart":
        result = cancelRestart(actor);
        break;
    }

    const userMsg = actionUserMessage(action);
    const inserted = withTransaction(() =>
      insertMessages(actor.conversationId, stepToMessages(userMsg, result)),
    );

    const view = getConversationView(actor.userId, actor.conversationId);
    const insertedChat = inserted.map((m) => ({
      id: m.id,
      seq: m.seq,
      role: m.role,
      content: m.content as MessageContent,
      createdAt: m.createdAt,
    }));

    return {
      messages: insertedChat,
      state: view.state,
      jobId: result.jobId,
    };
  });
}
