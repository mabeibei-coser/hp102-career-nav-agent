import { DomainError } from "../../errors";
import { newId } from "../../ids";
import { getDb } from "../client";

export type TaskStatus = "active" | "abandoned";
export type TaskStage =
  | "profile"
  | "quiz"
  | "interview"
  | "ready_for_report"
  | "report_generating"
  | "report_ready"
  | "report_failed";

export type CareerTask = {
  id: string;
  userId: string;
  conversationId: string;
  status: TaskStatus;
  stage: TaskStage;
  version: number;
  profileDraftJson: string;
  profileSnapshotJson: string | null;
  quizBankVersion: string;
  scoringJson: string | null;
  interviewQuestionsJson: string | null;
  latestReportUuid: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CreateTaskInput = {
  userId: string;
  conversationId: string;
  quizBankVersion: string;
  stage?: TaskStage;
  status?: TaskStatus;
  profileDraftJson?: string;
};

export type UpdateTaskInput = Partial<{
  status: TaskStatus;
  stage: TaskStage;
  profileDraftJson: string;
  profileSnapshotJson: string | null;
  scoringJson: string | null;
  interviewQuestionsJson: string | null;
  latestReportUuid: string | null;
}>;

function rowToTask(row: {
  id: string;
  user_id: string;
  conversation_id: string;
  status: TaskStatus;
  stage: TaskStage;
  version: number;
  profile_draft_json: string;
  profile_snapshot_json: string | null;
  quiz_bank_version: string;
  scoring_json: string | null;
  interview_questions_json: string | null;
  latest_report_uuid: string | null;
  created_at: number;
  updated_at: number;
}): CareerTask {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    status: row.status,
    stage: row.stage,
    version: row.version,
    profileDraftJson: row.profile_draft_json,
    profileSnapshotJson: row.profile_snapshot_json,
    quizBankVersion: row.quiz_bank_version,
    scoringJson: row.scoring_json,
    interviewQuestionsJson: row.interview_questions_json,
    latestReportUuid: row.latest_report_uuid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTask(input: CreateTaskInput): string {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  try {
    db.prepare(
      `INSERT INTO career_tasks (
         id, user_id, conversation_id, status, stage, version, profile_draft_json,
         quiz_bank_version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).run(
      id,
      input.userId,
      input.conversationId,
      input.status ?? "active",
      input.stage ?? "profile",
      input.profileDraftJson ?? "{}",
      input.quizBankVersion,
      now,
      now,
    );
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("idx_career_tasks_one_active")
    ) {
      throw err;
    }
    throw err;
  }
  return id;
}

export function getActiveTask(
  userId: string,
  conversationId: string,
): CareerTask | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, conversation_id, status, stage, version, profile_draft_json,
              profile_snapshot_json, quiz_bank_version, scoring_json, interview_questions_json,
              latest_report_uuid, created_at, updated_at
       FROM career_tasks
       WHERE user_id = ? AND conversation_id = ? AND status = 'active'`,
    )
    .get(userId, conversationId) as
    | {
        id: string;
        user_id: string;
        conversation_id: string;
        status: TaskStatus;
        stage: TaskStage;
        version: number;
        profile_draft_json: string;
        profile_snapshot_json: string | null;
        quiz_bank_version: string;
        scoring_json: string | null;
        interview_questions_json: string | null;
        latest_report_uuid: string | null;
        created_at: number;
        updated_at: number;
      }
    | undefined;
  return row ? rowToTask(row) : null;
}

export function getTask(userId: string, taskId: string): CareerTask | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, conversation_id, status, stage, version, profile_draft_json,
              profile_snapshot_json, quiz_bank_version, scoring_json, interview_questions_json,
              latest_report_uuid, created_at, updated_at
       FROM career_tasks WHERE id = ? AND user_id = ?`,
    )
    .get(taskId, userId) as
    | {
        id: string;
        user_id: string;
        conversation_id: string;
        status: TaskStatus;
        stage: TaskStage;
        version: number;
        profile_draft_json: string;
        profile_snapshot_json: string | null;
        quiz_bank_version: string;
        scoring_json: string | null;
        interview_questions_json: string | null;
        latest_report_uuid: string | null;
        created_at: number;
        updated_at: number;
      }
    | undefined;
  return row ? rowToTask(row) : null;
}

export function updateTask(
  taskId: string,
  expectedVersion: number,
  updates: UpdateTaskInput,
): CareerTask {
  const db = getDb();
  const current = db
    .prepare("SELECT version FROM career_tasks WHERE id = ?")
    .get(taskId) as { version: number } | undefined;

  if (!current) {
    throw new DomainError("NOT_FOUND");
  }
  if (current.version !== expectedVersion) {
    throw new DomainError("VERSION_CONFLICT");
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.stage !== undefined) {
    fields.push("stage = ?");
    values.push(updates.stage);
  }
  if (updates.profileDraftJson !== undefined) {
    fields.push("profile_draft_json = ?");
    values.push(updates.profileDraftJson);
  }
  if (updates.profileSnapshotJson !== undefined) {
    fields.push("profile_snapshot_json = ?");
    values.push(updates.profileSnapshotJson);
  }
  if (updates.scoringJson !== undefined) {
    fields.push("scoring_json = ?");
    values.push(updates.scoringJson);
  }
  if (updates.interviewQuestionsJson !== undefined) {
    fields.push("interview_questions_json = ?");
    values.push(updates.interviewQuestionsJson);
  }
  if (updates.latestReportUuid !== undefined) {
    fields.push("latest_report_uuid = ?");
    values.push(updates.latestReportUuid);
  }

  const nextVersion = current.version + 1;
  fields.push("version = ?");
  values.push(nextVersion);
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(taskId);

  db.prepare(`UPDATE career_tasks SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );

  const row = db
    .prepare(
      `SELECT id, user_id, conversation_id, status, stage, version, profile_draft_json,
              profile_snapshot_json, quiz_bank_version, scoring_json, interview_questions_json,
              latest_report_uuid, created_at, updated_at
       FROM career_tasks WHERE id = ?`,
    )
    .get(taskId) as {
    id: string;
    user_id: string;
    conversation_id: string;
    status: TaskStatus;
    stage: TaskStage;
    version: number;
    profile_draft_json: string;
    profile_snapshot_json: string | null;
    quiz_bank_version: string;
    scoring_json: string | null;
    interview_questions_json: string | null;
    latest_report_uuid: string | null;
    created_at: number;
    updated_at: number;
  };

  return rowToTask(row);
}
