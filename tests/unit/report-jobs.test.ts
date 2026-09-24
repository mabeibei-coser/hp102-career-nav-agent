import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import { createUser } from "@/lib/db/repositories/users";
import { createConversation } from "@/lib/db/repositories/conversations";
import { listMessages } from "@/lib/db/repositories/messages";
import { insertJob, listJobsByStatus } from "@/lib/db/repositories/report-jobs";
import { getReportByUuid } from "@/lib/db/repositories/reports";
import {
  confirmProfile,
  ensureActiveTask,
  requestReport,
  answerInterview,
  answerQuiz,
} from "@/lib/career/service";
import {
  recoverInterruptedReportJobs,
  runReportJob,
} from "@/lib/career/report/jobs";
import { COPY } from "@/lib/career/copy";
import { makeResumeDocx } from "../fixtures/make-resume-docx";
import { attachResume } from "@/lib/career/service";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";

let tmpDir = "";

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "hp102-report-jobs-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
  process.env.RESUME_DIR = path.join(tmpDir, "resumes");
  process.env.E2E_MOCK_MODE = "true";
  process.env.BANANAROUTER_API_KEY = "test-key";
  process.env.BANANAROUTER_BASE_URL = "https://api.bananarouter.com";
  process.env.BANANAROUTER_MODEL = "gemini-3.1-flash-lite";
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.E2E_MOCK_REPORT_FAIL;
});

async function advanceToReadyForReport(userId: string, conversationId: string) {
  const actor = { userId, conversationId };
  ensureActiveTask(actor);
  const buf = await makeResumeDocx();
  await attachResume(actor, {
    buffer: buf,
    fileName: "简历.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
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
  for (const id of ["Q1", "Q2", "Q3", "Q4"] as const) {
    answerInterview(actor, {
      questionId: id,
      text: "我喜欢和人打交道，也愿意学习新技能。",
      inputMethod: "card",
    });
  }
}

describe("report jobs", () => {
  it("requestReport queues job and rate limits", async () => {
    const userId = createUser();
    const conversationId = createConversation(userId, "测试");
    await advanceToReadyForReport(userId, conversationId);
    const actor = { userId, conversationId };

    const task = ensureActiveTask(actor);
    for (let i = 0; i < 5; i++) {
      insertJob({
        careerTaskId: task.id,
        userId,
        conversationId,
        status: "ready",
      });
    }
    expect(() =>
      requestReport(actor, { ip: "1.1.1.1", userAgent: "vitest" }),
    ).toThrow(expect.objectContaining({ code: "RATE_LIMITED" }));

    const userId2 = createUser();
    const conversationId2 = createConversation(userId2, "测试2");
    const actor2 = { userId: userId2, conversationId: conversationId2 };
    await advanceToReadyForReport(userId2, conversationId2);
    const result = requestReport(actor2, { ip: "1.1.1.1", userAgent: "vitest" });
    expect(result.jobId).toBeTruthy();
    expect(result.cards[0]).toMatchObject({ type: "report_status", status: "generating" });
    expect(ensureActiveTask(actor2).stage).toBe("report_generating");
  });

  it("runReportJob creates report and messages", async () => {
    const userId = createUser();
    const conversationId = createConversation(userId, "测试");
    await advanceToReadyForReport(userId, conversationId);
    const actor = { userId, conversationId };
    const { jobId } = requestReport(actor, {});

    await runReportJob(jobId!);

    const jobs = listJobsByStatus(["ready"]);
    expect(jobs).toHaveLength(1);
    const task = ensureActiveTask(actor);
    expect(task.stage).toBe("report_ready");
    const report = getReportByUuid(userId, jobs[0].reportUuid!);
    expect(report).toBeTruthy();
    expect(JSON.parse(report!.formDataJson).education).toBe("bachelor");
    expect(JSON.parse(report!.quizAnswersJson)).toHaveLength(8);
    expect(report!.modelProvider).toBe("mock");
    expect(report!.hasResume).toBe(true);

    const messages = listMessages(conversationId);
    const texts = messages.map((m) => JSON.stringify(m.content));
    expect(texts.some((t) => t.includes(COPY.reportReady))).toBe(true);
    expect(texts.some((t) => t.includes("report_summary"))).toBe(true);
  });

  it("handles mock failure and interrupted recovery", async () => {
    const userId = createUser();
    const conversationId = createConversation(userId, "测试");
    await advanceToReadyForReport(userId, conversationId);
    const actor = { userId, conversationId };

    process.env.E2E_MOCK_REPORT_FAIL = "true";
    const { jobId } = requestReport(actor, {});
    await runReportJob(jobId!);

    const failed = listJobsByStatus(["failed"])[0];
    expect(failed.errorCode).toBe("provider_error");
    expect(ensureActiveTask(actor).stage).toBe("report_failed");
    expect(getReportByUuid(userId, failed.reportUuid ?? "x")).toBeNull();

    const messages = listMessages(conversationId);
    const lastCard = messages
      .map((m) => m.content as { kind?: string; card?: { type: string; errorMessage?: string } })
      .find((c) => c.kind === "card" && c.card?.type === "report_status");
    expect(lastCard?.card?.errorMessage).toBe("生成服务暂时不可用");

    insertJob({
      careerTaskId: ensureActiveTask(actor).id,
      userId,
      conversationId,
      status: "generating",
    });
    recoverInterruptedReportJobs();
    const interrupted = listJobsByStatus(["failed"]).find(
      (j) => j.errorCode === "INTERRUPTED",
    );
    expect(interrupted).toBeTruthy();
    expect(
      listMessages(conversationId).some((m) =>
        JSON.stringify(m.content).includes(COPY.reportInterrupted),
      ),
    ).toBe(true);
  });
});
