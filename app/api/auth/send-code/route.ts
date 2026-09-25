import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http";
import { DomainError } from "@/lib/errors";
import {
  validatePhone,
  generateCode,
  sendSms,
  CODE_TTL_SEC,
  DAILY_CAP,
  RESEND_SEC,
} from "@/lib/sms/smsbao";
import {
  insertSmsCode,
  countRecentCodes,
  getLastCode,
} from "@/lib/db/repositories/sms-codes";
import { getOrCreateUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await getOrCreateUser();
    const body = await request.json();
    const phone = String(body?.phone ?? "").trim();
    validatePhone(phone);

    const last = getLastCode(phone);
    if (last) {
      const now = Math.floor(Date.now() / 1000);
      if (now - last.createdAt < RESEND_SEC) {
        throw new DomainError("RATE_LIMITED");
      }
    }

    const dailyCount = countRecentCodes(phone, 86400);
    if (dailyCount >= DAILY_CAP) {
      throw new DomainError("RATE_LIMITED", "今日发送次数已达上限");
    }

    const code = generateCode();
    await sendSms(phone, code);
    insertSmsCode(phone, code, CODE_TTL_SEC);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
