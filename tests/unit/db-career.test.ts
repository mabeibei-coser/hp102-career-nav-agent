import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { resetDbForTests } from "@/lib/db/client";
import { createUser } from "@/lib/db/repositories/users";
import { createConversation } from "@/lib/db/repositories/conversations";
import {
  createTask,
  getTask,
  updateTask,
} from "@/lib/db/repositories/career-tasks";
import {
  listQuizAnswers,
  upsertQuizAnswer,
} from "@/lib/db/repositories/quiz-answers";
import { insertInterviewAnswer } from "@/lib/db/repositories/interview-answers";

describe("db career repositories", () => {
  let tempDir: string;
  const originalDbPath = process.env.DB_PATH;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hp102-db-"));
    process.env.DB_PATH = join(tempDir, "test.db");
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = originalDbPath;
    }
  });

  function seedTask() {
    const userId = createUser();
    const conversationId = createConversation(userId, "对话");
    const taskId = createTask({
      userId,
      conversationId,
      quizBankVersion: "hp102-v1",
    });
    return { userId, conversationId, taskId };
  }

  it("allows only one active task per conversation", () => {
    const userId = createUser();
    const conversationId = createConversation(userId, "对话");
    const taskId = createTask({
      userId,
      conversationId,
      quizBankVersion: "hp102-v1",
    });

    expect(() =>
      createTask({
        userId,
        conversationId,
        quizBankVersion: "hp102-v1",
      }),
    ).toThrow();

    updateTask(taskId, 1, { status: "abandoned" });
    expect(() =>
      createTask({
        userId,
        conversationId,
        quizBankVersion: "hp102-v1",
      }),
    ).not.toThrow();
  });

  it("updates task version and scopes by user", () => {
    const { taskId } = seedTask();
    const otherUser = createUser();

    const updated = updateTask(taskId, 1, { stage: "quiz" });
    expect(updated.version).toBe(2);

    expect(() => updateTask(taskId, 1, { stage: "interview" })).toThrow(
      DomainError,
    );
    expect(() => updateTask(taskId, 1, { stage: "interview" })).toThrow(
      expect.objectContaining({ code: "VERSION_CONFLICT" }),
    );

    expect(getTask(otherUser, taskId)).toBeNull();
  });

  it("upserts quiz answers and rejects duplicate interview answers", () => {
    const { taskId } = seedTask();

    upsertQuizAnswer(taskId, {
      questionId: "SJT-01",
      optionLabel: "A",
      inputMethod: "button",
    });
    upsertQuizAnswer(taskId, {
      questionId: "SJT-01",
      optionLabel: "C",
      inputMethod: "chat",
    });

    const quizAnswers = listQuizAnswers(taskId);
    expect(quizAnswers).toHaveLength(1);
    expect(quizAnswers[0].optionLabel).toBe("C");

    insertInterviewAnswer(taskId, {
      questionId: "Q1",
      answerText: "第一次",
      inputMethod: "card",
    });
    expect(() =>
      insertInterviewAnswer(taskId, {
        questionId: "Q1",
        answerText: "第二次",
        inputMethod: "card",
      }),
    ).toThrow();
  });
});
