import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { resetDbForTests } from "@/lib/db/client";
import { createConversation } from "@/lib/db/repositories/conversations";
import {
  getActiveTask,
  getTask,
  updateTask,
} from "@/lib/db/repositories/career-tasks";
import { createUser } from "@/lib/db/repositories/users";
import { COPY } from "@/lib/career/copy";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";
import {
  answerQuiz,
  cancelRestart,
  confirmProfile,
  confirmRestart,
  ensureActiveTask,
  requestRestart,
  showCurrentStep,
} from "@/lib/career/service";

describe("service restart", () => {
  let tempDir: string;
  const originalDbPath = process.env.DB_PATH;
  const originalMock = process.env.E2E_MOCK_MODE;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hp102-service-"));
    process.env.DB_PATH = join(tempDir, "test.db");
    process.env.E2E_MOCK_MODE = "true";
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = originalDbPath;
    if (originalMock === undefined) delete process.env.E2E_MOCK_MODE;
    else process.env.E2E_MOCK_MODE = originalMock;
  });

  function actor() {
    const userId = createUser();
    const conversationId = createConversation(userId, "对话");
    return { userId, conversationId };
  }

  const validProfile = {
    identity: "recent_grad" as const,
    birthDate: "2003-05",
    education: "bachelor" as const,
    workYears: "lt1" as const,
    targetPosition: "",
  };

  async function reachQuiz(actor: { userId: string; conversationId: string }) {
    ensureActiveTask(actor);
    confirmProfile(actor, validProfile);
    await answerQuiz(actor, {
      questionId: QUIZ_QUESTIONS[0].id,
      optionLabel: "A",
      inputMethod: "button",
    });
  }

  it("asks for restart confirmation without changing data", async () => {
    const a = actor();
    await reachQuiz(a);
    const before = getActiveTask(a.userId, a.conversationId)!;

    const result = requestRestart(a);
    const after = getActiveTask(a.userId, a.conversationId)!;

    expect(result.notices).toEqual([COPY.restartAsk]);
    expect(result.cards[0].type).toBe("restart_confirm");
    expect(after.id).toBe(before.id);
    expect(after.stage).toBe("quiz");
  });

  it("confirms restart by abandoning old task and creating profile task", async () => {
    const a = actor();
    await reachQuiz(a);
    const oldTask = getActiveTask(a.userId, a.conversationId)!;

    const result = confirmRestart(a);
    const newTask = getActiveTask(a.userId, a.conversationId)!;
    const abandoned = getTask(a.userId, oldTask.id)!;

    expect(abandoned.status).toBe("abandoned");
    expect(newTask.id).not.toBe(oldTask.id);
    expect(newTask.stage).toBe("profile");
    expect(JSON.parse(newTask.profileDraftJson)).toEqual({
      identity: "recent_grad",
      birthDate: "2003-05",
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "",
      resumeFileId: null,
    });
    expect(result.notices).toEqual([COPY.restartDone]);
    expect(result.cards[0].type).toBe("profile_form");
  });

  it("rejects restart in profile and report_generating stages", async () => {
    const a = actor();
    ensureActiveTask(a);
    expect(() => requestRestart(a)).toThrow(DomainError);

    await reachQuiz(a);
    const task = getActiveTask(a.userId, a.conversationId)!;
    updateTask(task.id, task.version, { stage: "report_generating" });
    expect(() => requestRestart(a)).toThrow(
      expect.objectContaining({ code: "REPORT_IN_PROGRESS" }),
    );
  });

  it("cancels restart and shows current step card", async () => {
    const a = actor();
    await reachQuiz(a);
    requestRestart(a);

    const result = cancelRestart(a);
    expect(result.notices).toEqual([COPY.restartCancelled]);
    expect(result.cards[0].type).toBe("quiz_question");
    if (result.cards[0].type === "quiz_question") {
      expect(result.cards[0].questionId).toBe(QUIZ_QUESTIONS[1].id);
    }
  });

  it("showCurrentStep returns next interview question in interview stage", async () => {
    const a = actor();
    ensureActiveTask(a);
    confirmProfile(a, validProfile);
    for (const q of QUIZ_QUESTIONS) {
      await answerQuiz(a, {
        questionId: q.id,
        optionLabel: "A",
        inputMethod: "button",
      });
    }

    const result = showCurrentStep(a);
    expect(result.cards[0].type).toBe("interview_question");
    if (result.cards[0].type === "interview_question") {
      expect(result.cards[0].questionId).toBe("Q1");
    }
  });
});
