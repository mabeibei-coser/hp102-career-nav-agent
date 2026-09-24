import { getDb } from "../client";
import { newId } from "../../ids";

export type ResumeFile = {
  id: string;
  userId: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  text: string;
  charCount: number;
  truncated: boolean;
  extractedName: string | null;
  extractedPhone: string | null;
  createdAt: number;
};

export type ResumeFileInput = {
  originalName: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  text: string;
  charCount: number;
  truncated: boolean;
  extractedName?: string | null;
  extractedPhone?: string | null;
};

function rowToResumeFile(row: {
  id: string;
  user_id: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  storage_path: string;
  text: string;
  char_count: number;
  truncated: number;
  extracted_name: string | null;
  extracted_phone: string | null;
  created_at: number;
}): ResumeFile {
  return {
    id: row.id,
    userId: row.user_id,
    originalName: row.original_name,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    text: row.text,
    charCount: row.char_count,
    truncated: row.truncated === 1,
    extractedName: row.extracted_name,
    extractedPhone: row.extracted_phone,
    createdAt: row.created_at,
  };
}

export function insertResumeFile(
  userId: string,
  input: ResumeFileInput,
  id: string = newId(),
): string {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO resume_files (
       id, user_id, original_name, mime, size_bytes, storage_path, text, char_count,
       truncated, extracted_name, extracted_phone, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.originalName,
    input.mime,
    input.sizeBytes,
    input.storagePath,
    input.text,
    input.charCount,
    input.truncated ? 1 : 0,
    input.extractedName ?? null,
    input.extractedPhone ?? null,
    now,
  );
  return id;
}

export function getResumeFile(
  userId: string,
  fileId: string,
): ResumeFile | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, original_name, mime, size_bytes, storage_path, text, char_count,
              truncated, extracted_name, extracted_phone, created_at
       FROM resume_files WHERE id = ? AND user_id = ?`,
    )
    .get(fileId, userId) as
    | {
        id: string;
        user_id: string;
        original_name: string;
        mime: string;
        size_bytes: number;
        storage_path: string;
        text: string;
        char_count: number;
        truncated: number;
        extracted_name: string | null;
        extracted_phone: string | null;
        created_at: number;
      }
    | undefined;
  return row ? rowToResumeFile(row) : null;
}

export function countResumeFilesSince(userId: string, since: number): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM resume_files WHERE user_id = ? AND created_at >= ?",
    )
    .get(userId, since) as { count: number };
  return row.count;
}
