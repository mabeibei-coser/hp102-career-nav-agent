import { getDb } from "../client";

export type ProfileIdentity = "recent_grad" | "general_job_seeker";
export type ProfileEducation =
  | "junior_high"
  | "high_school"
  | "junior_college"
  | "bachelor"
  | "master_plus";
export type ProfileWorkYears = "lt1" | "1to3" | "3to10" | "gt10";

export type ProfileInput = {
  identity: ProfileIdentity;
  birthDate: string;
  education: ProfileEducation;
  workYears: ProfileWorkYears;
  targetPosition?: string;
  resumeFileId?: string | null;
};

export type Profile = ProfileInput & {
  userId: string;
  targetPosition: string;
  resumeFileId: string | null;
  version: number;
  confirmedAt: number;
};

function rowToProfile(row: {
  user_id: string;
  identity: ProfileIdentity;
  birth_date: string;
  education: ProfileEducation;
  work_years: ProfileWorkYears;
  target_position: string;
  resume_file_id: string | null;
  version: number;
  confirmed_at: number;
}): Profile {
  return {
    userId: row.user_id,
    identity: row.identity,
    birthDate: row.birth_date,
    education: row.education,
    workYears: row.work_years,
    targetPosition: row.target_position,
    resumeFileId: row.resume_file_id,
    version: row.version,
    confirmedAt: row.confirmed_at,
  };
}

export function upsertProfile(userId: string, input: ProfileInput): Profile {
  const db = getDb();
  const now = Date.now();
  const existing = db
    .prepare("SELECT version FROM profiles WHERE user_id = ?")
    .get(userId) as { version: number } | undefined;

  if (existing) {
    const version = existing.version + 1;
    db.prepare(
      `UPDATE profiles
       SET identity = ?, birth_date = ?, education = ?, work_years = ?, target_position = ?,
           resume_file_id = ?, version = ?, confirmed_at = ?
       WHERE user_id = ?`,
    ).run(
      input.identity,
      input.birthDate,
      input.education,
      input.workYears,
      input.targetPosition ?? "",
      input.resumeFileId ?? null,
      version,
      now,
      userId,
    );
  } else {
    db.prepare(
      `INSERT INTO profiles (
         user_id, identity, birth_date, education, work_years, target_position,
         resume_file_id, version, confirmed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      userId,
      input.identity,
      input.birthDate,
      input.education,
      input.workYears,
      input.targetPosition ?? "",
      input.resumeFileId ?? null,
      now,
    );
  }

  const profile = getProfile(userId);
  if (!profile) {
    throw new Error("Failed to upsert profile");
  }
  return profile;
}

export function getProfile(userId: string): Profile | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT user_id, identity, birth_date, education, work_years, target_position,
              resume_file_id, version, confirmed_at
       FROM profiles WHERE user_id = ?`,
    )
    .get(userId) as
    | {
        user_id: string;
        identity: ProfileIdentity;
        birth_date: string;
        education: ProfileEducation;
        work_years: ProfileWorkYears;
        target_position: string;
        resume_file_id: string | null;
        version: number;
        confirmed_at: number;
      }
    | undefined;
  return row ? rowToProfile(row) : null;
}
