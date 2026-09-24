import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { resetDbForTests } from "@/lib/db/client";
import { createConversation } from "@/lib/db/repositories/conversations";
import { getActiveTask } from "@/lib/db/repositories/career-tasks";
import { listQuizAnswers } from "@/lib/db/repositories/quiz-answers";
import { listInterviewAnswers } from "@/lib/db/repositories/interview-answers";
import { createUser } from "@/lib/db/repositories/users";
import { COPY } from "@/lib/career/copy";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";
import { scoreQuiz } from "@/lib/career/scoring";
import {
  answerInterview,
  answerQuiz,
  confirmProfile,
  ensureActiveTask,
} from "@/lib/career/service";

describe("service quiz and interview", () => {
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

  function startQuiz(actor: { userId: string; conversationId: string }) {
    ensureActiveTask(actor);
    confirmProfile(actor, validProfile);
  }

  it("returns next quiz cards and allows changing an earlier answer", async () => {
    const a = actor();
    startQuiz(a);

    const order = QUIZ_QUESTIONS.map((q) => q.id);
    for (let i = 0; i < 7; i++) {
      const result = await answerQuiz(a, {
        questionId: order[i],
        optionLabel: "A",
        inputMethod: "button",
      });
      expect(result.cards[0].type).toBe("quiz_question");
      if (result.cards[0].type === "quiz_question") {
        expect(result.cards[0].questionId).toBe(order[i + 1]);
      }
    }

    await answerQuiz(a, {
      questionId: "SJT-01",
      optionLabel: "C",
      inputMethod: "button",
    });
    const answers = listQuizAnswers(getActiveTask(a.userId, a.conversationId)!.id);
    expect(answers).toHaveLength(7);
    expect(answers.find((x) => x.questionId === "SJT-01")?.optionLabel).toBe("C");
  });

  it("completes quiz with scoring and interview questions", async () => {
    const a = actor();
    startQuiz(a);

    let lastResult;
    for (const q of QUIZ_QUESTIONS) {
      lastResult = await answerQuiz(a, {
        questionId: q.id,
        optionLabel: "A",
        inputMethod: "button",
      });
    }

    const task = getActiveTask(a.userId, a.conversationId)!;
    const answers = listQuizAnswers(task.id).map((item) => ({
      questionId: item.questionId,
      selectedLabel: item.optionLabel,
    }));
    expect(JSON.parse(task.scoringJson!)).toEqual(
      scoreQuiz(answers, QUIZ_QUESTIONS),
    );
    expect(JSON.parse(task.interviewQuestionsJson!)).toHaveLength(4);
    expect(task.stage).toBe("interview");
    expect(lastResult!.notices).toEqual([COPY.quizDone]);
    expect(lastResult!.cards[0].type).toBe("interview_question");
    if (lastResult!.cards[0].type === "interview_question") {
      expect(lastResult!.cards[0].questionId).toBe("Q1");
    }
  });

  it("rejects answerQuiz in profile stage", async () => {
    const a = actor();
    ensureActiveTask(a);
    await expect(
      answerQuiz(a, {
        questionId: "SJT-01",
        optionLabel: "A",
        inputMethod: "button",
      }),
    ).rejects.toMatchObject({ code: "STAGE_MISMATCH" });
  });

  it("handles interview flow with ordering and validation", async () => {
    const a = actor();
    startQuiz(a);
    for (const q of QUIZ_QUESTIONS) {
      await answerQuiz(a, {
        questionId: q.id,
        optionLabel: "A",
        inputMethod: "button",
      });
    }

    expect(() =>
      answerInterview(a, {
        questionId: "Q2",
        text: "我喜欢和人打交道",
        inputMethod: "card",
      }),
    ).toThrow(DomainError);

    expect(() =>
      answerInterview(a, {
        questionId: "Q1",
        text: "好",
        inputMethod: "card",
      }),
    ).toThrow(DomainError);

    let result = answerInterview(a, {
      questionId: "Q1",
      text: "我喜欢和人打交道",
      inputMethod: "card",
    });
    expect(result.cards[0].type).toBe("interview_question");

    result = answerInterview(a, {
      questionId: "Q2",
      text: "希望工作更有挑战",
      inputMethod: "card",
    });
    expect(result.cards[0].type).toBe("interview_question");

    result = answerInterview(a, {
      questionId: "Q3",
      text: "团队氛围开放",
      inputMethod: "card",
    });
    expect(result.cards[0].type).toBe("interview_question");

    result = answerInterview(a, {
      questionId: "Q4",
      text: "薪资待遇合理",
      inputMethod: "card",
    });

    const task = getActiveTask(a.userId, a.conversationId)!;
    expect(task.stage).toBe("ready_for_report");
    expect(result.notices).toEqual([COPY.interviewDone]);
    expect(result.cards[0].type).toBe("report_cta");
    expect(listInterviewAnswers(task.id)).toHaveLength(4);
  });
});
