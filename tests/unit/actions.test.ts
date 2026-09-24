import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import { createUser } from "@/lib/db/repositories/users";
import { createConversation } from "@/lib/conversation/service";
import { handleAction } from "@/lib/conversation/actions";
import { withConversationLock } from "@/lib/conversation/lock";
import { assertChatRate } from "@/lib/conversation/rate-limit";
import { listMessages } from "@/lib/db/repositories/messages";
import { listInterviewAnswers } from "@/lib/db/repositories/interview-answers";
import { COPY } from "@/lib/career/copy";
import { ensureActiveTask, confirmProfile } from "@/lib/career/service";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";
import { DomainError } from "@/lib/errors";

let tmpDir = "";

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "hp102-actions-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
  process.env.RESUME_DIR = path.join(tmpDir, "resumes");
  process.env.E2E_MOCK_MODE = "true";
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("actions", () => {
  it("confirm_profile writes messages and advances stage", async () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const task = ensureActiveTask({ userId, conversationId: conversation.id });

    const result = await handleAction(
      { userId, conversationId: conversation.id },
      {
        type: "confirm_profile",
        taskId: task.id,
        profile: {
          identity: "recent_grad",
          birthDate: "2003-05",
          education: "bachelor",
          workYears: "lt1",
          targetPosition: "",
        },
      },
    );

    expect(result.state.stage).toBe("quiz");
    expect(result.messages.map((m) => m.role)).toEqual([
      "user",
      "notice",
      "card",
    ]);
    expect(result.messages[0].content).toMatchObject({
      text: expect.stringContaining("（确认档案）"),
    });
    expect(result.messages[1].content).toMatchObject({ text: COPY.profileConfirmed });
    expect(listMessages(conversation.id)).toHaveLength(5);
  });

  it("rejects invalid stage actions and defaults interview input method", async () => {
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

    await expect(
      handleAction(actor, {
        type: "answer_quiz",
        taskId: "00000000-0000-4000-8000-000000000099",
        questionId: "SJT-01",
        optionLabel: "A",
      }),
    ).rejects.toMatchObject({ code: "STAGE_MISMATCH" });

    await expect(
      handleAction(actor, {
        type: "generate_report",
        taskId: ensureActiveTask(actor).id,
      }),
    ).rejects.toMatchObject({ code: "STAGE_MISMATCH" });

    for (const q of QUIZ_QUESTIONS) {
      await handleAction(actor, {
        type: "answer_quiz",
        taskId: ensureActiveTask(actor).id,
        questionId: q.id,
        optionLabel: "A",
      });
    }
    for (const id of ["Q1", "Q2", "Q3", "Q4"] as const) {
      await handleAction(actor, {
        type: "answer_interview",
        taskId: ensureActiveTask(actor).id,
        questionId: id,
        text: "我喜欢和人打交道",
      });
    }

    const task = ensureActiveTask(actor);
    const q1 = listInterviewAnswers(task.id).find((a) => a.questionId === "Q1");
    expect(q1?.inputMethod).toBe("card");
  });

  it("enforces conversation lock and chat rate", async () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = withConversationLock(conversation.id, async () => {
      await gate;
      return "ok";
    });

    await expect(
      withConversationLock(conversation.id, async () => "second"),
    ).rejects.toMatchObject({ code: "BUSY" });

    release();
    await first;

    const { insertMessages } = await import("@/lib/db/repositories/messages");
    for (let i = 0; i < 30; i++) {
      insertMessages(conversation.id, [
        { role: "user", content: { kind: "text", text: `m${i}` } },
      ]);
    }
    expect(() => assertChatRate(userId)).toThrow(
      expect.objectContaining({ code: "RATE_LIMITED" }),
    );
  });
});
