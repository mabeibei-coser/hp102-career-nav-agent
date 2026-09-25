import { createHash } from "crypto";
import { getDb } from "../client";

export function hashSmsCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function insertSmsCode(
  phone: string,
  code: string,
  ttlSec: number,
): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSec;
  db.prepare(
    "INSERT INTO sms_codes (phone, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, 0, ?)",
  ).run(phone, hashSmsCode(code), expiresAt, now);
}

export function countRecentCodes(phone: string, windowSec: number): number {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - windowSec;
  const row = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM sms_codes WHERE phone = ? AND created_at >= ?",
    )
    .get(phone, since) as { cnt: number };
  return row.cnt;
}

export function getLastCode(
  phone: string,
): {
  id: number;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
} | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, code_hash, expires_at, attempts, created_at
       FROM sms_codes WHERE phone = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(phone) as
    | {
        id: number;
        code_hash: string;
        expires_at: number;
        attempts: number;
        created_at: number;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    attempts: row.attempts,
    createdAt: row.created_at,
  };
}

export function incrementAttempts(id: number): void {
  getDb()
    .prepare("UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?")
    .run(id);
}

export function invalidateCode(id: number): void {
  getDb()
    .prepare("UPDATE sms_codes SET attempts = 5, expires_at = 0 WHERE id = ?")
    .run(id);
}

export function verifySmsCode(
  phone: string,
  code: string,
): { valid: boolean; reason?: string } {
  const entry = getLastCode(phone);
  if (!entry) return { valid: false, reason: "验证码不正确" };

  const now = Math.floor(Date.now() / 1000);
  if (entry.attempts >= 5) {
    return { valid: false, reason: "验证码已失效" };
  }
  if (now > entry.expiresAt) {
    return { valid: false, reason: "验证码已过期" };
  }

  if (entry.codeHash !== hashSmsCode(code)) {
    incrementAttempts(entry.id);
    const after = getLastCode(phone);
    if (after && after.attempts >= 5) {
      invalidateCode(entry.id);
    }
    return { valid: false, reason: "验证码不正确" };
  }

  invalidateCode(entry.id);
  return { valid: true };
}
