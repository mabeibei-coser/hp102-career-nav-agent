import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import { createUser } from "@/lib/db/repositories/users";
import { createConversation } from "@/lib/conversation/service";
import {
  executeTool,
  toolDefsFor,
  toolResultForModel,
} from "@/lib/agent/tools";
import { loadAgentContext } from "@/lib/agent/prompt";
import { QUIZ_QUESTION_IDS } from "@/lib/career/quiz-bank";
import {
  answerQuiz,
  confirmProfile,
  ensureActiveTask,
} from "@/lib/career/service";
import { listInterviewAnswers } from "@/lib/db/repositories/interview-answers";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";

let tmpDir = "";

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "hp102-agent-tools-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
  process.env.RESUME_DIR = path.join(tmpDir, "resumes");
  process.env.E2E_MOCK_MODE = "true";
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
  rmSync(tmpDir, { recursive: true, force: true });
});

function jsonHasForbiddenKeys(obj: unknown): boolean {
  const s = JSON.stringify(obj);
  return (
    s.includes("$ref") ||
    s.includes("oneOf") ||
    s.includes("additionalProperties") ||
    s.includes('"type":"function"') ||
    s.includes('"type": "function"')
  );
}

describe("agent tools", () => {
  it("toolDefsFor quiz returns expected tools and schema", () => {
    const defs = toolDefsFor("quiz");
    expect(defs.map((d) => d.name)).toEqual([
      "show_current_step",
      "record_quiz_answer",
      "request_restart",
    ]);
    const quizTool = defs.find((d) => d.name === "record_quiz_answer")!;
    expect(quizTool.parameters.properties?.questionId?.enum).toEqual(
      [...QUIZ_QUESTION_IDS],
    );
    for (const def of defs) {
      expect(jsonHasForbiddenKeys(def)).toBe(false);
    }
  });

  it("rejects invalid args and disallowed tools", async () => {
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
    const ctx = loadAgentContext(actor);

    const badLabel = await executeTool(
      { name: "record_quiz_answer", args: { questionId: "SJT-01", optionLabel: "E" } },
      actor,
      ctx,
    );
    expect(badLabel).toMatchObject({ ok: false, code: "INVALID_ARGUMENTS" });

    const extraField = await executeTool(
      {
        name: "record_quiz_answer",
        args: { questionId: "SJT-01", optionLabel: "A", extra: true },
      },
      actor,
      ctx,
    );
    expect(extraField).toMatchObject({ ok: false, code: "INVALID_ARGUMENTS" });

    const wrongStage = await executeTool(
      { name: "propose_profile", args: { identity: "recent_grad" } },
      actor,
      ctx,
    );
    expect(wrongStage).toMatchObject({ ok: false, code: "TOOL_NOT_ALLOWED" });
  });

  it("records interview answer via chat and formats tool result", async () => {
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
    for (const q of QUIZ_QUESTIONS) {
      await answerQuiz(actor, {
        questionId: q.id,
        optionLabel: "A",
        inputMethod: "button",
      });
    }
    const ctx = loadAgentContext(actor);
    const userText = "我喜欢和人打交道";
    const exec = await executeTool(
      { name: "record_interview_answer", args: { questionId: "Q1" } },
      actor,
      ctx,
      { userText },
    );
    expect(exec.ok).toBe(true);
    const task = ensureActiveTask(actor);
    const answers = listInterviewAnswers(task.id);
    const q1 = answers.find((a) => a.questionId === "Q1");
    expect(q1?.answerText).toBe(userText);
    expect(q1?.inputMethod).toBe("chat");

    const modelView = toolResultForModel(exec);
    expect(Object.keys(modelView).sort()).toEqual(
      ["ok", "result", "stage", "systemCopy"].sort(),
    );
    expect(modelView.ok).toBe(true);
  });
});
