"use client";

import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/api-base";
import type { CardPayload } from "@/lib/career/cards";
import { CardShell } from "./card-shell";

type LoginRequiredCard = Extract<CardPayload, { type: "login_required" }>;

type LoginCardProps = {
  card: LoginRequiredCard;
  active: boolean;
  disabled?: boolean;
  onLoggedIn: () => void;
};

export function LoginCardView({
  active,
  disabled,
  onLoggedIn,
}: LoginCardProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [done, setDone] = useState(false);

  const startCountdown = useCallback(() => {
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = useCallback(async () => {
    if (sending || countdown > 0) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/auth/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error?.message ?? "发送失败");
        return;
      }
      setStep("code");
      startCountdown();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSending(false);
    }
  }, [phone, sending, countdown, startCountdown]);

  const handleVerify = useCallback(async () => {
    if (verifying) return;
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch(apiUrl("/api/auth/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error?.message ?? "验证失败");
        return;
      }
      setDone(true);
      onLoggedIn();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setVerifying(false);
    }
  }, [phone, code, verifying, onLoggedIn]);

  const phoneValid = /^1[3-9]\d{9}$/.test(phone.trim());
  const codeValid = /^\d{6}$/.test(code.trim());
  const isInactive = !active || disabled || done;

  if (done) {
    return (
      <CardShell title="手机号验证" inactive>
        <p className="text-sm text-gray-500">已验证，正在生成报告…</p>
      </CardShell>
    );
  }

  return (
    <CardShell title="手机号验证" inactive={isInactive}>
      <p className="mb-4 text-sm text-gray-600">
        生成报告前需要验证手机号，验证后即可生成。
      </p>
      <div className="space-y-3">
        <div>
          <input
            type="tel"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
            }
            disabled={isInactive || step === "code"}
            placeholder="请输入手机号"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base disabled:bg-gray-50"
          />
        </div>
        {step === "phone" && (
          <button
            type="button"
            onClick={handleSendCode}
            disabled={!phoneValid || sending || isInactive}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-base font-medium text-white disabled:opacity-40 min-h-[44px]"
          >
            {sending ? "发送中…" : "获取验证码"}
          </button>
        )}
        {step === "code" && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                disabled={isInactive}
                placeholder="请输入 6 位验证码"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-base"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={countdown > 0 || sending || isInactive}
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 disabled:opacity-40"
              >
                {countdown > 0 ? `${countdown}s` : "重新发送"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleVerify}
              disabled={!codeValid || verifying || isInactive}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-base font-medium text-white disabled:opacity-40 min-h-[44px]"
            >
              {verifying ? "验证中…" : "验证并生成报告"}
            </button>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </CardShell>
  );
}
