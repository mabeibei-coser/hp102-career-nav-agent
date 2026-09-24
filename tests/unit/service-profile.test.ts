import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { resetDbForTests } from "@/lib/db/client";
import { createConversation } from "@/lib/db/repositories/conversations";
import { getActiveTask } from "@/lib/db/repositories/career-tasks";
import { getProfile, upsertProfile } from "@/lib/db/repositories/profiles";
import { countResumeFilesSince } from "@/lib/db/repositories/resume-files";
import { createUser } from "@/lib/db/repositories/users";
import { COPY } from "@/lib/career/copy";
import {
  attachResume,
  confirmProfile,
  ensureActiveTask,
  proposeProfile,
} from "@/lib/career/service";
import { makeResumeDocx } from "../fixtures/make-resume-docx";

describe("service profile", () => {
  let tempDir: string;
  const originalDbPath = process.env.DB_PATH;
  const originalResumeDir = process.env.RESUME_DIR;
  const originalMock = process.env.E2E_MOCK_MODE;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hp102-service-"));
    process.env.DB_PATH = join(tempDir, "test.db");
    process.env.RESUME_DIR = join(tempDir, "resumes");
    process.env.E2E_MOCK_MODE = "true";
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = originalDbPath;
    if (originalResumeDir === undefined) delete process.env.RESUME_DIR;
    else process.env.RESUME_DIR = originalResumeDir;
    if (originalMock === undefined) delete process.env.E2E_MOCK_MODE;
    else process.env.E2E_MOCK_MODE = originalMock;
  });

  function actor() {
    const userId = createUser();
    const conversationId = createConversation(userId, "对话");
    return { userId, conversationId };
  }

  it("creates profile-stage task with empty or prefilled draft", () => {
    const a = actor();
    const task = ensureActiveTask(a);
    expect(task.stage).toBe("profile");
    expect(JSON.parse(task.profileDraftJson)).toEqual({});

    const a2 = actor();
    upsertProfile(a2.userId, {
      identity: "recent_grad",
      birthDate: "2003-05",
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "运营",
    });
    const task2 = ensureActiveTask(a2);
    expect(JSON.parse(task2.profileDraftJson)).toEqual({
      identity: "recent_grad",
      birthDate: "2003-05",
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "运营",
      resumeFileId: null,
    });
  });

  it("proposes partial profile and validates invalid birthDate", () => {
    const a = actor();
    ensureActiveTask(a);

    const result = proposeProfile(a, {
      education: "bachelor",
      birthDate: "2003-13",
    });

    const task = getActiveTask(a.userId, a.conversationId)!;
    const draft = JSON.parse(task.profileDraftJson);
    expect(draft.education).toBe("bachelor");
    expect(draft.birthDate).toBeUndefined();
    expect(result.forModel).toContain("出生年月");
    expect(result.cards[0].type).toBe("profile_form");
  });

  it("confirms profile and rejects repeat confirmation", () => {
    const a = actor();
    ensureActiveTask(a);

    const valid = {
      identity: "recent_grad" as const,
      birthDate: "2003-05",
      education: "bachelor" as const,
      workYears: "lt1" as const,
      targetPosition: "",
    };

    const result = confirmProfile(a, valid);
    const task = getActiveTask(a.userId, a.conversationId)!;
    const profile = getProfile(a.userId);

    expect(profile?.version).toBe(1);
    expect(task.stage).toBe("quiz");
    expect(task.profileSnapshotJson).toBeTruthy();
    expect(result.notices).toEqual([COPY.profileConfirmed]);
    expect(result.cards[0].type).toBe("quiz_question");
    if (result.cards[0].type === "quiz_question") {
      expect(result.cards[0].questionId).toBe("SJT-01");
    }

    expect(() => confirmProfile(a, valid)).toThrow(DomainError);
  });

  it("attaches resume and prefills education without overwriting user fields", async () => {
    const a = actor();
    ensureActiveTask(a);
    proposeProfile(a, { identity: "recent_grad", targetPosition: "已有岗位" });

    const buf = await makeResumeDocx();
    const result = await attachResume(a, {
      buffer: buf,
      fileName: "简历.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const task = getActiveTask(a.userId, a.conversationId)!;
    const draft = JSON.parse(task.profileDraftJson);
    expect(countResumeFilesSince(a.userId, 0)).toBe(1);
    expect(draft.resumeFileId).toBeTruthy();
    expect(draft.education).toBe("bachelor");
    expect(draft.targetPosition).toBe("已有岗位");
    expect(result.cards[0].type).toBe("profile_form");
  });
});
