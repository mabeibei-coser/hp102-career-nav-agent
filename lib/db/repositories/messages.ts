import { getDb, withTransaction } from "../client";
import { newId } from "../../ids";

export type MessageRole = "user" | "assistant" | "notice" | "card";

export type MessageInput = {
  role: MessageRole;
  content: unknown;
};

export type Message = {
  id: string;
  conversationId: string;
  seq: number;
  role: MessageRole;
  content: unknown;
  createdAt: number;
};

function rowToMessage(row: {
  id: string;
  conversation_id: string;
  seq: number;
  role: MessageRole;
  content_json: string;
  created_at: number;
}): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    seq: row.seq,
    role: row.role,
    content: JSON.parse(row.content_json),
    createdAt: row.created_at,
  };
}

export function insertMessages(
  conversationId: string,
  messages: MessageInput[],
): Message[] {
  if (messages.length === 0) {
    return [];
  }

  return withTransaction(() => {
    const db = getDb();
    const count = messages.length;
    const startSeq = (
      db
        .prepare(
          "UPDATE conversations SET next_seq = next_seq + ?, updated_at = ? WHERE id = ? RETURNING next_seq",
        )
        .get(count, Date.now(), conversationId) as { next_seq: number }
    ).next_seq;
    const firstSeq = startSeq - count;
    const now = Date.now();
    const insert = db.prepare(
      "INSERT INTO messages (id, conversation_id, seq, role, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );

    const inserted: Message[] = [];
    messages.forEach((message, index) => {
      const id = newId();
      const seq = firstSeq + index;
      insert.run(
        id,
        conversationId,
        seq,
        message.role,
        JSON.stringify(message.content),
        now,
      );
      inserted.push({
        id,
        conversationId,
        seq,
        role: message.role,
        content: message.content,
        createdAt: now,
      });
    });

    return inserted;
  });
}

export function listMessages(conversationId: string): Message[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, conversation_id, seq, role, content_json, created_at FROM messages WHERE conversation_id = ? ORDER BY seq ASC",
    )
    .all(conversationId) as Array<{
    id: string;
    conversation_id: string;
    seq: number;
    role: MessageRole;
    content_json: string;
    created_at: number;
  }>;
  return rows.map(rowToMessage);
}

export function countUserMessagesSince(
  userId: string,
  since: number,
): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ? AND m.role = 'user' AND m.created_at >= ?`,
    )
    .get(userId, since) as { count: number };
  return row.count;
}
