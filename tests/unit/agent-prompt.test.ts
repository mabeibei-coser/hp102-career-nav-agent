import { readFileSync } from "fs";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import { createUser } from "@/lib/db/repositories/users";
import { createConversation } from "@/lib/conversation/service";
import { loadSkillBody } from "@/lib/agent/skill";
import { buildSystemPrompt, loadAgentContext } from "@/lib/agent/prompt";
import { TOOLS_BY_STAGE } from "@/lib/career/stages";
import {
  answerQuiz,
  confirmProfile,
  ensureActiveTask,
} from "@/lib/career/service";
import { attachResume } from "@/lib/career/service";
import { makeResumeDocx } from "../fixtures/make-resume-docx";
import { insertReport } from "@/lib/db/repositories/reports";
import { updateTask } from "@/lib/db/repositories/career-tasks";
import { insertMessages } from "@/lib/db/repositories/messages";
import { showCurrentStep } from "@/lib/career/service";
import reportMock from "../fixtures/report-mock.json";
import { randomUUID } from "crypto";

let tmpDir = "";

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "hp102-agent-prompt-"));
  process.env.DB_PATH = path.join(tmpDir, "test.db");
  process.env.RESUME_DIR = path.join(tmpDir, "resumes");
  process.env.E2E_MOCK_MODE = "true";
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("agent prompt", () => {
  it("distinguishes the chat opening from an existing card even beyond the history window", () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const actor = { userId, conversationId: conversation.id };
    expect(buildSystemPrompt(actor, loadAgentContext(actor))).toContain("本任务尚未展示档案卡");
    const step = showCurrentStep(actor);
    insertMessages(conversation.id, [{ role: "card", content: { kind: "card", card: step.cards[0] } }]);
    insertMessages(conversation.id, Array.from({ length: 42 }, () => ({
      role: "user" as const, content: { kind: "text", text: "咨询面试技巧" },
    })));
    expect(buildSystemPrompt(actor, loadAgentContext(actor))).toContain("本任务已展示档案卡");
    const fresh = createConversation(userId);
    const freshActor = { userId, conversationId: fresh.conversation.id };
    expect(loadAgentContext(freshActor).profileCardShown).toBe(false);
  });

  it("loadSkillBody strips frontmatter and includes key sections", () => {
    const body = loadSkillBody();
    expect(body.startsWith("---")).toBe(false);
    expect(body).toContain("## 红线");
    expect(body).toContain("## 操作规则");
    const raw = readFileSync(
      path.join(process.cwd(), "lib/agent/skill/career-navigation.md"),
      "utf8",
    );
    expect(raw).toContain("## 红线");
  });

  it("quiz stage prompt includes current question without resume body", async () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const actor = { userId, conversationId: conversation.id };
    const buf = await makeResumeDocx();
    await attachResume(actor, {
      buffer: buf,
      fileName: "我的简历.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
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

    const ctx = loadAgentContext(actor);
    const prompt = buildSystemPrompt(actor, ctx);
    expect(prompt).toContain("- 当前题：SJT-05「");
    expect(prompt).toContain("已答 3/8");
    expect(prompt).toContain("A. ");
    expect(prompt).toContain("已上传《我的简历.docx》");
    expect(prompt).not.toContain("张三");
    expect(prompt).not.toContain("工作经历");
  });

  it("report_ready includes summary; profile excludes it and lists stage tools", async () => {
    const userId = createUser();
    const { conversation } = createConversation(userId);
    const actor = { userId, conversationId: conversation.id };
    const task = ensureActiveTask(actor);
    const reportUuid = randomUUID();
    insertReport({
      createdAt: Date.now(),
      uuid: reportUuid,
      userId,
      conversationId: conversation.id,
      careerTaskId: task.id,
      formDataJson: "{}",
      quizAnswersJson: "[]",
      scoringJson: "{}",
      interviewQ1q2Json: "[]",
      interviewQ3q4Json: "[]",
      interviewQuestionsJson: "[]",
      reportJson: JSON.stringify(reportMock),
      modelProvider: "mock",
      modelName: "mock",
    });
    updateTask(task.id, task.version, {
      stage: "report_ready",
      latestReportUuid: reportUuid,
    });

    const ctx = loadAgentContext(actor);
    const readyPrompt = buildSystemPrompt(actor, ctx);
    expect(readyPrompt).toMatch(/\n【报告摘要】\n\{/);

    const profileUserId = createUser();
    const { conversation: profileConv } = createConversation(profileUserId);
    const profileActor = {
      userId: profileUserId,
      conversationId: profileConv.id,
    };
    const profileCtx = loadAgentContext(profileActor);
    const profilePrompt = buildSystemPrompt(profileActor, profileCtx);
    expect(profilePrompt).not.toMatch(/\n【报告摘要】\n/);
    const opsSection = profilePrompt.split("【本阶段你可以做的操作】")[1] ?? "";
    for (const tool of TOOLS_BY_STAGE.profile) {
      expect(opsSection).toContain(`- ${tool}：`);
    }
    for (const tool of TOOLS_BY_STAGE.quiz) {
      if (!TOOLS_BY_STAGE.profile.includes(tool)) {
        expect(opsSection).not.toContain(`- ${tool}：`);
      }
    }
  });
});
