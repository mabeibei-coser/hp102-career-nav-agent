import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoreQuiz } from "@/lib/career/scoring";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";
import {
  buildReportRetryHook,
  buildReportValidator,
  REDLINE_ISSUE_PREFIX,
  ADVICE_COUNT_ISSUE,
  type AllSections,
} from "@/lib/career/report/validate";
import { findRedlineWords } from "@/lib/career/report/redline";
import {
  normalizeOverview,
  patchAdvice,
} from "@/lib/career/report/normalize";
import { generateJson } from "@/lib/llm/generate-json";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/fixtures/report-mock.json"),
    "utf-8",
  ),
) as AllSections;

const scoring = scoreQuiz(
  QUIZ_QUESTIONS.map((q) => ({ questionId: q.id, selectedLabel: "A" })),
  QUIZ_QUESTIONS,
);

describe("report validate", () => {
  beforeEach(() => {
    process.env.E2E_MOCK_MODE = "true";
    process.env.BANANAROUTER_API_KEY = "test-key";
    process.env.BANANAROUTER_BASE_URL = "https://api.bananarouter.com";
    process.env.BANANAROUTER_MODEL = "gemini-3.1-flash-lite";
  });

  it("validates fixture and mock generateJson report", async () => {
    const validator = buildReportValidator(true, scoring);
    expect(validator(fixture)).toBeNull();

    const { data } = await generateJson<AllSections>({
      purpose: "report",
      system: "output json report",
      user: "please output json report",
      maxOutputTokens: 16384,
      temperature: 0.6,
      timeoutMs: 90000,
    });
    expect(data).toEqual(fixture);
  });

  it("detects redline words and retry hook", () => {
    const bad = {
      ...fixture,
      overview: {
        ...fixture.overview,
        summary: `${fixture.overview.summary}你目前处于失业状态`,
      },
    };
    const issue = buildReportValidator(true, scoring)(bad);
    expect(issue?.startsWith(REDLINE_ISSUE_PREFIX)).toBe(true);
    expect(issue).toContain("失业");

    const hook = buildReportRetryHook(scoring, "user json");
    const retry = hook(issue!, bad);
    expect(retry?.user).toContain("禁用词");

    expect(findRedlineWords("他已经 36 岁了，MBTI 是 INTJ")).toEqual([
      "MBTI",
      "已经 36 岁",
    ]);
    expect(findRedlineWords("今天适合先尝试行政岗位")).toEqual([]);
  });

  it("validates resume and advice count; normalizes overview and patches advice", () => {
    const noResumeValidator = buildReportValidator(true, scoring);
    expect(
      noResumeValidator({ ...fixture, resumeDiagnosis: null }),
    ).toBeTruthy();

    const twoAdvice = {
      ...fixture,
      advice: { topThree: fixture.advice.topThree.slice(0, 2) },
    };
    expect(buildReportValidator(true, scoring)(twoAdvice)).toBe(
      ADVICE_COUNT_ISSUE,
    );

    const normalized = normalizeOverview(
      { ...fixture.overview },
      scoring,
    );
    expect(normalized.fourDimRadar.map((d) => d.score)).toEqual(
      scoring.fourDim.map((d) => d.score),
    );

    const patched = patchAdvice({
      topThree: [
        ...fixture.advice.topThree,
        {
          title: "补充行动计划四",
          detail: "整理目标岗位清单并记录投递反馈，形成每周复盘。",
          deadline: "两周内",
        },
        {
          title: "补充行动计划五",
          detail: "参加一次线下招聘活动并准备自我介绍稿。",
          deadline: "一个月内",
        },
      ],
    });
    expect(patched.topThree).toHaveLength(3);
    expect(patched.topThree[0].title).toBe(fixture.advice.topThree[0].title);
  });
});
