import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import {
  createConversation,
  getConversationForUser,
} from "@/lib/conversation/service";
import { getConversationView } from "@/lib/conversation/view";
import { COPY } from "@/lib/career/copy";
import {
  answerQuiz,
  confirmProfile,
  ensureActiveTask,
  showCurrentStep,
  requestReport,
} from "@/lib/career/service";
import { createUser } from "@/lib/db/repositories/users";
import { insertMessages } from "@/lib/db/repositories/messages";
import { updateTask } from "@/lib/db/repositories/career-tasks";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";
import { DomainError } from "@/lib/errors";

let tmpDir = "";

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "hp102-conv-view-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
  process.env.RESUME_DIR = path.join(tmpDir, "resumes");
  process.env.E2E_MOCK_MODE = "true";
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("conversation view", () => {
  it("creates and reloads conversation with opening only", () => {
    const userId = createUser();
    const { messages, state } = createConversation(userId);
    expect(messages[0].content).toMatchObject({ text: COPY.opening });
    expect(messages).toHaveLength(1);
    expect(state.stage).toBe("profile");
    expect(state.activeCardMessageId).toBeNull();
    expect(state.fallbackCard).toBeNull();
    const reloaded = getConversationView(userId, state.conversationId);
    expect(reloaded.messages).toEqual(messages);
    expect(reloaded.state.fallbackCard).toBeNull();
  });

  it("tracks quiz progress and active card", async () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const actor = { userId, conversationId: conversation.id };
    confirmProfile(actor, {
      identity: "recent_grad",
      birthDate: "2003-05",
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "",
    });
    for (const id of ["SJT-01", "SJT-02", "SJT-04"]) {
      await answerQuiz(actor, {
        questionId: id,
        optionLabel: "A",
        inputMethod: "button",
      });
    }

    const task = ensureActiveTask(actor);
    insertMessages(conversation.id, [
      {
        role: "card",
        content: {
          kind: "card",
          card: {
            type: "quiz_question",
            taskId: task.id,
            questionId: "SJT-05",
            index: 4,
            total: 8,
            text: "q",
            options: [],
          },
        },
      },
    ]);

    const view = getConversationView(userId, conversation.id);
    expect(view.state.stage).toBe("quiz");
    expect(view.state.answersByTask[task.id].quiz).toHaveProperty("SJT-01");
    const active = view.messages.find((m) => m.id === view.state.activeCardMessageId);
    expect(
      active?.content.kind === "card" &&
        active.content.card.type === "quiz_question" &&
        active.content.card.questionId === "SJT-05",
    ).toBe(true);
  });

  it("retains old profile cards and prefills a returning user's new card only on request", () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const actor = { userId, conversationId: conversation.id };
    const step = showCurrentStep(actor);
    const [oldCard] = insertMessages(conversation.id, [
      { role: "card", content: { kind: "card", card: step.cards[0] } },
    ]);
    expect(getConversationView(userId, conversation.id).state.activeCardMessageId).toBe(oldCard.id);
    confirmProfile(actor, {
      identity: "recent_grad", birthDate: "2003-05", education: "bachelor", workYears: "lt1", targetPosition: "",
    });
    const fresh = createConversation(userId);
    expect(fresh.messages).toHaveLength(1);
    expect(fresh.state.activeCardMessageId).toBeNull();
    expect(fresh.state.fallbackCard).toBeNull();
    const requested = showCurrentStep({ userId, conversationId: fresh.conversation.id });
    expect(requested.cards[0]).toMatchObject({ type: "profile_form", draft: { education: "bachelor", identity: "recent_grad" } });
  });

  it("computes fallback card, poll interval, and access control", () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const actor = { userId, conversationId: conversation.id };
    confirmProfile(actor, {
      identity: "recent_grad",
      birthDate: "2003-05",
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "",
    });

    const quizView = getConversationView(userId, conversation.id);
    expect(quizView.state.activeCardMessageId).toBeNull();
    expect(quizView.state.fallbackCard?.type).toBe("quiz_question");
    const fallback = quizView.state.fallbackCard;
    if (fallback?.type === "quiz_question") {
      expect(fallback.questionId).toBe(QUIZ_QUESTIONS[0].id);
    }

    const task = ensureActiveTask(actor);
    updateTask(task.id, task.version, { stage: "report_generating" });
    const generatingView = getConversationView(userId, conversation.id);
    expect(generatingView.state.stage).toBe("report_generating");
    expect(generatingView.state.pollAfterMs).toBe(3000);
    expect(generatingView.state.fallbackCard).toBeNull();

    const otherUser = createUser();
    expect(() => getConversationForUser(otherUser, conversation.id)).toThrow(
      DomainError,
    );
  });
});
