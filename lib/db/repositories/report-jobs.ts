import { newId } from "../../ids";
import { getDb } from "../client";

export type ReportJobStatus = "queued" | "generating" | "ready" | "failed";

export type ReportJob = {
  id: string;
  careerTaskId: string;
  userId: string;
  conversationId: string;
  status: ReportJobStatus;
  errorCode: string | null;
  reportUuid: string | null;
  provider: string | null;
  model: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};

export type InsertJobInput = {
  careerTaskId: string;
  userId: string;
  conversationId: string;
  status: ReportJobStatus;
  ip?: string | null;
  userAgent?: string | null;
};

export type UpdateJobInput = Partial<{
  status: ReportJobStatus;
  errorCode: string | null;
  reportUuid: string | null;
  provider: string | null;
  model: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}>;

function rowToJob(row: {
  id: string;
  career_task_id: string;
  user_id: string;
  conversation_id: string;
  status: ReportJobStatus;
  error_code: string | null;
  report_uuid: string | null;
  provider: string | null;
  model: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
}): ReportJob {
  return {
    id: row.id,
    careerTaskId: row.career_task_id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    status: row.status,
    errorCode: row.error_code,
    reportUuid: row.report_uuid,
    provider: row.provider,
    model: row.model,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function getJob(jobId: string): ReportJob | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, career_task_id, user_id, conversation_id, status, error_code, report_uuid,
              provider, model, ip, user_agent, created_at, started_at, finished_at
       FROM report_jobs WHERE id = ?`,
    )
    .get(jobId) as
    | {
        id: string;
        career_task_id: string;
        user_id: string;
        conversation_id: string;
        status: ReportJobStatus;
        error_code: string | null;
        report_uuid: string | null;
        provider: string | null;
        model: string | null;
        ip: string | null;
        user_agent: string | null;
        created_at: number;
        started_at: number | null;
        finished_at: number | null;
      }
    | undefined;
  return row ? rowToJob(row) : null;
}

export function insertJob(input: InsertJobInput): string {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  db.prepare(
    `INSERT INTO report_jobs (
       id, career_task_id, user_id, conversation_id, status, ip, user_agent, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.careerTaskId,
    input.userId,
    input.conversationId,
    input.status,
    input.ip ?? null,
    input.userAgent ?? null,
    now,
  );
  return id;
}

export function updateJob(jobId: string, updates: UpdateJobInput): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.errorCode !== undefined) {
    fields.push("error_code = ?");
    values.push(updates.errorCode);
  }
  if (updates.reportUuid !== undefined) {
    fields.push("report_uuid = ?");
    values.push(updates.reportUuid);
  }
  if (updates.provider !== undefined) {
    fields.push("provider = ?");
    values.push(updates.provider);
  }
  if (updates.model !== undefined) {
    fields.push("model = ?");
    values.push(updates.model);
  }
  if (updates.startedAt !== undefined) {
    fields.push("started_at = ?");
    values.push(updates.startedAt);
  }
  if (updates.finishedAt !== undefined) {
    fields.push("finished_at = ?");
    values.push(updates.finishedAt);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(jobId);
  db.prepare(`UPDATE report_jobs SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
}

export function listJobsByStatus(statuses: ReportJobStatus[]): ReportJob[] {
  const db = getDb();
  if (statuses.length === 0) {
    return [];
  }
  const placeholders = statuses.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT id, career_task_id, user_id, conversation_id, status, error_code, report_uuid,
              provider, model, ip, user_agent, created_at, started_at, finished_at
       FROM report_jobs WHERE status IN (${placeholders})
       ORDER BY created_at ASC`,
    )
    .all(...statuses) as Array<{
    id: string;
    career_task_id: string;
    user_id: string;
    conversation_id: string;
    status: ReportJobStatus;
    error_code: string | null;
    report_uuid: string | null;
    provider: string | null;
    model: string | null;
    ip: string | null;
    user_agent: string | null;
    created_at: number;
    started_at: number | null;
    finished_at: number | null;
  }>;
  return rows.map(rowToJob);
}

export function countJobsSince(userId: string, since: number): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM report_jobs WHERE user_id = ? AND created_at >= ?",
    )
    .get(userId, since) as { count: number };
  return row.count;
}
