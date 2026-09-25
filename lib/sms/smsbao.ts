import { createHash } from "crypto";
import { DomainError } from "../errors";

function md5(str: string): string {
  return createHash("md5").update(str).digest("hex");
}

const PHONE_RE = /^1[3-9]\d{9}$/;
const CODE_TTL_SEC = 300; // 5 minutes
const DAILY_CAP = 10;
const RESEND_SEC = 60;

export { CODE_TTL_SEC, DAILY_CAP, RESEND_SEC };

export function generateCode(): string {
  if (process.env.E2E_MOCK_MODE === "true") return "123456";
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function validatePhone(phone: string): void {
  if (!PHONE_RE.test(phone)) {
    throw new DomainError("INVALID_INPUT", "手机号格式不正确");
  }
}

export async function sendSms(
  phone: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (process.env.E2E_MOCK_MODE === "true") return;

  const user = process.env.SMSBAO_USER;
  const pass = process.env.SMSBAO_PASS;
  const sign = process.env.SMSBAO_SIGN;
  if (!user || !pass || !sign) {
    throw new DomainError("SMS_FAILED", "短信服务未配置");
  }

  const content = `【${sign}】您的验证码是${code}，5分钟内有效。`;
  const url = `https://api.smsbao.com/sms?u=${encodeURIComponent(user)}&p=${md5(pass)}&m=${phone}&c=${encodeURIComponent(content)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    const body = (await res.text()).trim();
    if (body !== "0") {
      throw new DomainError("SMS_FAILED");
    }
  } catch (err) {
    if (err instanceof DomainError) throw err;
    throw new DomainError("SMS_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}
