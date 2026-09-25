import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 60_000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is required for PDF tokens");
  return s;
}

function signPayload(uuid: string, exp: number): string {
  return createHmac("sha256", secret())
    .update(`${uuid}${exp}`)
    .digest("hex");
}

/** Token format: `{expMs}.{hmacHex}` — valid for 60 seconds. */
export function signPdfToken(uuid: string, now = Date.now()): string {
  const exp = now + TTL_MS;
  return `${exp}.${signPayload(uuid, exp)}`;
}

export function verifyPdfToken(
  uuid: string,
  token: string,
  now = Date.now(),
): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = signPayload(uuid, exp);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
