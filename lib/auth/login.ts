import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getDb, withTransaction } from "../db/client";
import { verifySmsCode } from "../db/repositories/sms-codes";
import { DomainError } from "../errors";
import type { SessionData } from "../session";
import { getSessionOptions } from "../session";

export async function verifyAndLogin(
  phone: string,
  code: string,
): Promise<{ userId: string; merged: boolean }> {
  const result = verifySmsCode(phone, code);
  if (!result.valid) {
    throw new DomainError("INVALID_INPUT", result.reason ?? "验证码不正确");
  }

  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(),
  );
  const currentUserId = session.userId;
  if (!currentUserId) {
    throw new DomainError("INTERNAL");
  }

  const db = getDb();
  const existingUser = db
    .prepare("SELECT id FROM users WHERE phone = ? AND id != ?")
    .get(phone, currentUserId) as { id: string } | undefined;

  if (existingUser) {
    const targetUserId = existingUser.id;
    withTransaction(() => {
      const tables = [
        "conversations",
        "profiles",
        "resume_files",
        "career_tasks",
        "report_jobs",
        "reports",
      ];
      for (const table of tables) {
        db.prepare(
          `UPDATE ${table} SET user_id = ? WHERE user_id = ?`,
        ).run(targetUserId, currentUserId);
      }
      db.prepare("UPDATE users SET phone = ? WHERE id = ?").run(
        phone,
        targetUserId,
      );
    });

    session.userId = targetUserId;
    await session.save();
    return { userId: targetUserId, merged: true };
  }

  db.prepare("UPDATE users SET phone = ? WHERE id = ?").run(
    phone,
    currentUserId,
  );
  await session.save();
  return { userId: currentUserId, merged: false };
}
