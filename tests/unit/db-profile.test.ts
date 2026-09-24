import { existsSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import { saveResumeFile } from "@/lib/db/files";
import { createUser } from "@/lib/db/repositories/users";
import { getProfile, upsertProfile } from "@/lib/db/repositories/profiles";
import {
  countResumeFilesSince,
  getResumeFile,
  insertResumeFile,
} from "@/lib/db/repositories/resume-files";

describe("db profile repositories", () => {
  let tempDir: string;
  const originalDbPath = process.env.DB_PATH;
  const originalResumeDir = process.env.RESUME_DIR;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hp102-db-"));
    process.env.DB_PATH = join(tempDir, "test.db");
    process.env.RESUME_DIR = join(tempDir, "resumes");
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
    if (originalResumeDir === undefined) {
      delete process.env.RESUME_DIR;
    } else {
      process.env.RESUME_DIR = originalResumeDir;
    }
  });

  it("upserts profile and increments version", () => {
    const userId = createUser();
    upsertProfile(userId, {
      identity: "recent_grad",
      birthDate: "2000-01",
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "行政专员",
    });
    upsertProfile(userId, {
      identity: "recent_grad",
      birthDate: "2000-01",
      education: "master_plus",
      workYears: "lt1",
      targetPosition: "行政专员",
    });

    const profile = getProfile(userId);
    expect(profile?.education).toBe("master_plus");
    expect(profile?.version).toBe(2);
  });

  it("scopes resume files by user and counts uploads", () => {
    const userA = createUser();
    const userB = createUser();
    const fileId = insertResumeFile(userA, {
      originalName: "resume.pdf",
      mime: "application/pdf",
      sizeBytes: 10,
      storagePath: `${userA}/file.pdf`,
      text: "hello",
      charCount: 5,
      truncated: false,
    });

    expect(getResumeFile(userB, fileId)).toBeNull();
    expect(countResumeFilesSince(userA, 0)).toBe(1);
  });

  it("saves resume files to disk and rejects unsupported extensions", () => {
    const userId = createUser();
    const fileId = "11111111-1111-4111-8111-111111111111";
    const relativePath = saveResumeFile(
      userId,
      fileId,
      "pdf",
      Buffer.from("x"),
    );
    expect(relativePath).toBe(`${userId}/${fileId}.pdf`);
    expect(
      existsSync(join(process.env.RESUME_DIR!, userId, `${fileId}.pdf`)),
    ).toBe(true);

    expect(() =>
      saveResumeFile(userId, fileId, "exe", Buffer.from("x")),
    ).toThrow();
  });
});
