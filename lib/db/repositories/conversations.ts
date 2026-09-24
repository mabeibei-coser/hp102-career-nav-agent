import { getDb } from "../client";
import { newId } from "../../ids";

export type Conversation = {
  id: string;
  userId: string;
  title: string;
  nextSeq: number;
  createdAt: number;
  updatedAt: number;
};

function rowToConversation(row: {
  id: string;
  user_id: string;
  title: string;
  next_seq: number;
  created_at: number;
  updated_at: number;
}): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    nextSeq: row.next_seq,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createConversation(userId: string, title: string): string {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  db.prepare(
    "INSERT INTO conversations (id, user_id, title, next_seq, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
  ).run(id, userId, title, now, now);
  return id;
}

export function getConversation(
  userId: string,
  conversationId: string,
): Conversation | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, user_id, title, next_seq, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?",
    )
    .get(conversationId, userId) as
    | {
        id: string;
        user_id: string;
        title: string;
        next_seq: number;
        created_at: number;
        updated_at: number;
      }
    | undefined;
  return row ? rowToConversation(row) : null;
}

export function touchConversation(conversationId: string): void {
  const db = getDb();
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
    Date.now(),
    conversationId,
  );
}

export function getLatestConversation(userId: string): Conversation | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, user_id, title, next_seq, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
    )
    .get(userId) as
    | {
        id: string;
        user_id: string;
        title: string;
        next_seq: number;
        created_at: number;
        updated_at: number;
      }
    | undefined;
  return row ? rowToConversation(row) : null;
}
