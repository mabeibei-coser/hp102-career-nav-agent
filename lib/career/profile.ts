import { z } from "zod";
import type { ActiveUserIdentity, JobFormData } from "./types";

export const USER_IDENTITY_OPTIONS: {
  value: ActiveUserIdentity;
  label: string;
  description: string;
}[] = [
  {
    value: "recent_grad",
    label: "应届毕业生",
    description: "毕业后尚未找到第一份工作",
  },
  {
    value: "general_job_seeker",
    label: "一般社会求职者",
    description: "有工作经历，正在求职中",
  },
];

export const EDUCATION_OPTIONS = [
  { value: "junior_high", label: "初中及以下" },
  { value: "high_school", label: "高中/中专/技校" },
  { value: "junior_college", label: "高职/大专" },
  { value: "bachelor", label: "本科" },
  { value: "master_plus", label: "硕士及以上" },
];

export const WORK_YEARS_OPTIONS = [
  { value: "lt1", label: "0-1年（含）" },
  { value: "1to3", label: "1-3年（含）" },
  { value: "3to10", label: "3-10年（含）" },
  { value: "gt10", label: "10年以上" },
];

const identityEnum = z.enum(["recent_grad", "general_job_seeker"]);
const educationEnum = z.enum([
  "junior_high",
  "high_school",
  "junior_college",
  "bachelor",
  "master_plus",
]);
const workYearsEnum = z.enum(["lt1", "1to3", "3to10", "gt10"]);
const birthDate = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .refine((v) => {
    const y = Number(v.slice(0, 4));
    return y >= 1940 && y <= new Date().getFullYear();
  });

export const profileInputSchema = z.object({
  identity: identityEnum,
  birthDate,
  education: educationEnum,
  workYears: workYearsEnum,
  targetPosition: z.string().trim().max(60).default(""),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

export const profileDraftSchema = profileInputSchema.partial().extend({
  resumeFileId: z.string().uuid().nullable().optional(),
});
export type ProfileDraft = z.infer<typeof profileDraftSchema>;
export type ProfileField = "identity" | "birthDate" | "education" | "workYears";

const REQUIRED_FIELDS: ProfileField[] = [
  "identity",
  "birthDate",
  "education",
  "workYears",
];

export function missingRequired(draft: ProfileDraft): ProfileField[] {
  return REQUIRED_FIELDS.filter((field) => draft[field] === undefined);
}

export function labelOfEducation(code: string): string {
  return EDUCATION_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export function labelOfWorkYears(code: string): string {
  return WORK_YEARS_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export function labelOfIdentity(code: string): string {
  return USER_IDENTITY_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export type ProfileSnapshot = ProfileInput & {
  profileVersion: number;
  resumeFileId: string | null;
  resumeFileName: string | null;
  resumeStoragePath: string | null;
  resumeText: string | null;
  extractedName: string | null;
  extractedPhone: string | null;
};

export function toJobFormData(s: ProfileSnapshot): JobFormData {
  return {
    identity: s.identity,
    birthDate: s.birthDate,
    education: s.education,
    workYears: s.workYears,
    targetPosition: s.targetPosition,
    resumeText: s.resumeText ?? undefined,
    resumeFileName: s.resumeFileName ?? undefined,
    name: s.extractedName ?? undefined,
    phone: s.extractedPhone ?? undefined,
  };
}
