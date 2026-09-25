import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http";
import { DomainError } from "@/lib/errors";
import { verifyAndLogin } from "@/lib/auth/login";
import { getOrCreateUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await getOrCreateUser();
    const body = await request.json();
    const phone = String(body?.phone ?? "").trim();
    const code = String(body?.code ?? "").trim();

    if (!phone || !code) {
      throw new DomainError("INVALID_INPUT");
    }

    const result = await verifyAndLogin(phone, code);
    return NextResponse.json({ ok: true, userId: result.userId });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
