import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { createUser } from "@/lib/db/repositories/users";
import { createConversation } from "@/lib/db/repositories/conversations";
import { createTask } from "@/lib/db/repositories/career-tasks";
import {
  countJobsSince,
  insertJob,
  listJobsByStatus,
  updateJob,
} from "@/lib/db/repositories/report-jobs";
import {
  getReportByUuid,
  insertReport,
} from "@/lib/db/repositories/reports";
import { insertLlmCall } from "@/lib/db/repositories/llm-calls";

describe("db report repositories", () => {
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

  function seedReportContext() {
    const userId = createUser();
    const conversationId = createConversation(userId, "对话");
    const taskId = createTask({
      userId,
      conversationId,
      quizBankVersion: "hp102-v1",
    });
    return { userId, conversationId, taskId };
  }

  it("tracks report jobs by status and count", () => {
    const { userId, conversationId, taskId } = seedReportContext();
    const jobId = insertJob({
      careerTaskId: taskId,
      userId,
      conversationId,
      status: "queued",
    });
    updateJob(jobId, { status: "generating" });

    const jobs = listJobsByStatus(["queued", "generating"]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(jobId);
    expect(jobs[0].status).toBe("generating");
    expect(countJobsSince(userId, 0)).toBe(1);
  });

  it("scopes reports by user", () => {
    const { userId, conversationId, taskId } = seedReportContext();
    const otherUser = createUser();
    const uuid = "22222222-2222-4222-8222-222222222222";

    insertReport({
      createdAt: Date.now(),
      uuid,
      userId,
      conversationId,
      careerTaskId: taskId,
      formDataJson: "{}",
      quizAnswersJson: "[]",
      scoringJson: "{}",
      interviewQ1q2Json: "{}",
      interviewQ3q4Json: "{}",
      interviewQuestionsJson: "[]",
      reportJson: "{}",
      modelProvider: "bananarouter",
      modelName: "gemini-3.1-flash-lite",
    });

    expect(getReportByUuid(userId, uuid)?.uuid).toBe(uuid);
    expect(getReportByUuid(otherUser, uuid)).toBeNull();
  });

  it("inserts llm call metadata without prompt fields", () => {
    insertLlmCall({
      provider: "bananarouter",
      model: "gemini-3.1-flash-lite",
      kind: "chat",
      purpose: "chat",
      step: 1,
      ok: true,
      latencyMs: 12,
      finishReason: "STOP",
    });

    const db = getDb();
    const row = db
      .prepare("SELECT ok, kind FROM llm_calls")
      .get() as { ok: number; kind: string };
    expect(row.ok).toBe(1);
    expect(row.kind).toBe("chat");

    expect(() =>
      insertLlmCall({
        provider: "bananarouter",
        model: "gemini-3.1-flash-lite",
        kind: "xxx" as "chat",
        purpose: "chat",
        step: 1,
        ok: true,
        latencyMs: 12,
      }),
    ).toThrow();
  });
});
