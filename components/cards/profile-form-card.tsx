"use client";

import { useRef, useState } from "react";
import type { CardPayload } from "@/lib/career/cards";
import {
  EDUCATION_OPTIONS,
  USER_IDENTITY_OPTIONS,
  WORK_YEARS_OPTIONS,
  type ProfileField,
  type ProfileInput,
} from "@/lib/career/profile";
import { CardShell } from "./card-shell";

type ProfileFormCard = Extract<CardPayload, { type: "profile_form" }>;

const FIELD_LABELS: Record<ProfileField, string> = {
  identity: "身份",
  birthDate: "出生年月",
  education: "学历",
  workYears: "工作年限",
};

type ProfileFormCardProps = {
  card: ProfileFormCard;
  active: boolean;
  disabled?: boolean;
  onConfirm: (profile: ProfileInput) => void;
  onUploadResume: (file: File) => void;
  loadingAction?: boolean;
};

export function ProfileFormCardView({
  card,
  active,
  disabled,
  onConfirm,
  onUploadResume,
  loadingAction,
}: ProfileFormCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({
    identity: card.draft.identity ?? "",
    birthDate: card.draft.birthDate ?? "",
    education: card.draft.education ?? "",
    workYears: card.draft.workYears ?? "",
    targetPosition: card.draft.targetPosition ?? "",
  });
  const [resumeName, setResumeName] = useState(card.resume?.fileName ?? null);

  const readOnly = !active;
  const missing: ProfileField[] = (
    ["identity", "birthDate", "education", "workYears"] as ProfileField[]
  ).filter((f) => !draft[f]);
  const canConfirm =
    active &&
    !disabled &&
    !loadingAction &&
    missing.length === 0 &&
    draft.identity &&
    draft.birthDate &&
    draft.education &&
    draft.workYears;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("文件不能超过 5MB");
      return;
    }
    setResumeName(file.name);
    onUploadResume(file);
    e.target.value = "";
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      identity: draft.identity as ProfileInput["identity"],
      birthDate: draft.birthDate,
      education: draft.education as ProfileInput["education"],
      workYears: draft.workYears as ProfileInput["workYears"],
      targetPosition: draft.targetPosition,
    });
  };

  return (
    <CardShell title="就业档案" inactive={!active}>
      <div className="space-y-4 text-base">
        <fieldset disabled={readOnly || disabled}>
          <legend className="mb-2 text-sm font-medium text-gray-700">
            身份
            {missing.includes("identity") && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </legend>
          <div className="space-y-2">
            {USER_IDENTITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
              >
                <input
                  type="radio"
                  name="identity"
                  value={opt.value}
                  checked={draft.identity === opt.value}
                  onChange={() =>
                    setDraft((d) => ({ ...d, identity: opt.value }))
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-sm text-gray-500">{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            出生年月
            {missing.includes("birthDate") && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>
          <input
            type="month"
            value={draft.birthDate}
            onChange={(e) =>
              setDraft((d) => ({ ...d, birthDate: e.target.value }))
            }
            disabled={readOnly || disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            学历
            {missing.includes("education") && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>
          <select
            value={draft.education}
            onChange={(e) =>
              setDraft((d) => ({ ...d, education: e.target.value }))
            }
            disabled={readOnly || disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          >
            <option value="">请选择</option>
            {EDUCATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            工作年限
            {missing.includes("workYears") && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>
          <select
            value={draft.workYears}
            onChange={(e) =>
              setDraft((d) => ({ ...d, workYears: e.target.value }))
            }
            disabled={readOnly || disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          >
            <option value="">请选择</option>
            {WORK_YEARS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            目标岗位
          </label>
          <input
            type="text"
            value={draft.targetPosition}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                targetPosition: e.target.value.slice(0, 60),
              }))
            }
            disabled={readOnly || disabled}
            placeholder="选填，最多 60 字"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-50"
          />
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={handleFileChange}
            disabled={readOnly || disabled}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={readOnly || disabled}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            上传简历
          </button>
          {resumeName && (
            <span className="ml-2 text-sm text-gray-600">{resumeName}</span>
          )}
          <p className="mt-2 text-xs text-gray-500">
            上传前请遮盖身份证号、家庭住址等敏感信息
          </p>
        </div>

        {missing.length > 0 && active && (
          <p className="text-sm text-red-500">
            请填写：{missing.map((f) => FIELD_LABELS[f]).join("、")}
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-40"
        >
          {loadingAction ? "提交中…" : "确认档案"}
        </button>
      </div>
    </CardShell>
  );
}
