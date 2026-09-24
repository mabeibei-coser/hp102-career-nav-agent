import { getDb } from "../client";
import { newId } from "../../ids";

export type User = {
  id: string;
  phone: string | null;
  createdAt: number;
  lastSeenAt: number;
};

function rowToUser(row: {
  id: string;
  phone: string | null;
  created_at: number;
  last_seen_at: number;
}): User {
  return {
    id: row.id,
    phone: row.phone,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function createUser(phone?: string | null): string {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  db.prepare(
    "INSERT INTO users (id, phone, created_at, last_seen_at) VALUES (?, ?, ?, ?)",
  ).run(id, phone ?? null, now, now);
  return id;
}

export function getUser(id: string): User | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id, phone, created_at, last_seen_at FROM users WHERE id = ?")
    .get(id) as
    | {
        id: string;
        phone: string | null;
        created_at: number;
        last_seen_at: number;
      }
    | undefined;
  return row ? rowToUser(row) : null;
}

export function touchUser(id: string): void {
  const db = getDb();
  db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(
    Date.now(),
    id,
  );
}

export function countUsers(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };
  return row.count;
}
