import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { resetDbForTests, getDb } from "@/lib/db/client";

describe("admin-hub compatibility", () => {
  let tmpDir: string;
  let originalDbPath: string | undefined;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `hp102-admin-${randomUUID().slice(0, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
    originalDbPath = process.env.DB_PATH;
    process.env.DB_PATH = join(tmpDir, "test.db");
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.RESUME_DIR = join(tmpDir, "resumes");
    process.env.BANANAROUTER_API_KEY = "test";
    process.env.BANANAROUTER_BASE_URL = "https://api.bananarouter.com";
    process.env.BANANAROUTER_MODEL = "gemini-3.1-flash-lite";
    process.env.E2E_MOCK_MODE = "true";
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = originalDbPath;
    }
  });

  it("navSelect-compatible columns exist and are queryable", () => {
    const db = getDb();

    const mockReport = {
      overview: { personality: { type: "T" }, fourDimRadar: [], summary: "S" },
      strength: { abilityRadar: [], strengths: [], growth: [] },
      positioning: {
        primary: { position: "P" },
        secondary: { position: "S" },
      },
      advice: { topThree: [] },
      employmentIndex: 45,
      meta: {
        generatedAt: new Date().toISOString(),
        formData: {
          identity: "recent_grad",
          education: "bachelor",
          workYears: "lt1",
          birthDate: "2003-05",
          targetPosition: "行政专员",
          phone: "13800138000",
        },
        scoring: { fourDim: [], ability: [] },
        hasResume: true,
      },
    };

    db.prepare(
      "INSERT INTO users (id, phone, created_at, last_seen_at) VALUES (?, ?, ?, ?)",
    ).run("u1", "13800138000", Date.now(), Date.now());

    db.prepare(
      "INSERT INTO conversations (id, user_id, title, next_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("c1", "u1", "test", 1, Date.now(), Date.now());

    const uuid = randomUUID();
    db.prepare(
      `INSERT INTO reports (
         created_at, uuid, user_id, user_phone, conversation_id, career_task_id,
         user_identity, target_position, target_education, has_resume, resume_filename,
         ip, duration_ms, sections_status,
         form_data_json, quiz_answers_json, scoring_json,
         interview_q1q2_json, interview_q3q4_json, interview_questions_json,
         report_json, model_provider, model_name
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      Date.now(),
      uuid,
      "u1",
      "13800138000",
      "c1",
      "t1",
      "recent_grad",
      "行政专员",
      "bachelor",
      1,
      "resume.docx",
      "127.0.0.1",
      5000,
      "complete",
      JSON.stringify(mockReport.meta.formData),
      "[]",
      "{}",
      "{}",
      "{}",
      "[]",
      JSON.stringify(mockReport),
      "mock",
      "mock",
    );

    const row = db
      .prepare(
        `SELECT id, created_at, target_position, has_resume, resume_filename,
                user_identity, uuid, duration_ms, sections_status, ip,
                form_data_json, report_json
         FROM reports WHERE uuid = ?`,
      )
      .get(uuid) as Record<string, unknown>;

    expect(row).toBeTruthy();
    expect(row.target_position).toBe("行政专员");

    const edu = db
      .prepare(
        "SELECT json_extract(form_data_json, '$.education') as edu FROM reports WHERE uuid = ?",
      )
      .get(uuid) as { edu: string };
    expect(edu.edu).toBe("bachelor");

    const eidx = db
      .prepare(
        "SELECT json_extract(report_json, '$.employmentIndex') as idx FROM reports WHERE uuid = ?",
      )
      .get(uuid) as { idx: number };
    expect(typeof eidx.idx).toBe("number");
  });
});
