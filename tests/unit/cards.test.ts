import { describe, expect, it } from "vitest";
import {
  profileFormCard,
  quizQuestionCard,
  reportSummaryCard,
} from "@/lib/career/cards";
import type { QuizDimension, ReportData } from "@/lib/career/types";

describe("cards", () => {
  it("builds quiz question card without scoring metadata", () => {
    const card = quizQuestionCard("task-1", "SJT-04");

    expect(card.type).toBe("quiz_question");
    if (card.type !== "quiz_question") return;
    expect(card.index).toBe(3);
    expect(card.total).toBe(8);
    expect(card.options).toHaveLength(4);
    expect(card.options.every((o) => "label" in o && "text" in o)).toBe(true);

    const serialized = JSON.stringify(card);
    expect(serialized).not.toContain("poleValue");
    expect(serialized).not.toContain("weights");
  });

  it("builds profile form card with missing fields", () => {
    const card = profileFormCard(
      "task-1",
      { identity: "recent_grad" },
      null,
    );

    expect(card.type).toBe("profile_form");
    if (card.type !== "profile_form") return;
    expect(card.missing).toEqual(["birthDate", "education", "workYears"]);
    expect(card.resume).toBeNull();
  });

  it("builds report summary card from report data and pole labels", () => {
    const poleLabels: Record<QuizDimension, { left: string; right: string }> = {
      personality: { left: "内敛", right: "外向" },
      workstyle: { left: "按部", right: "灵活" },
      value: { left: "稳定", right: "成长" },
      direction: { left: "深耕", right: "多元" },
    };

    const report: ReportData = {
      meta: {
        generatedAt: "2026-01-01",
        formData: {
          identity: "recent_grad",
          education: "bachelor",
          workYears: "lt1",
          targetPosition: "行政专员",
        },
        scoring: { fourDim: [], ability: [] },
        hasResume: false,
        interviewQ1Q2: {},
      },
      overview: {
        personality: { type: "协调型", traits: [], description: "" },
        fourDimRadar: [
          { name: "性格底色", score: 55 },
          { name: "工作风格", score: 60 },
          { name: "价值驱动", score: 50 },
          { name: "适配方向", score: 45 },
        ],
        summary: "总评摘要",
      },
      strength: { abilityRadar: [], strengths: [], growth: [] },
      positioning: {
        primary: {
          position: "行政专员",
          matchScore: 80,
          reasoning: "",
          industries: [],
          culture: "",
          teamRole: "",
          fitReason: "沟通细致",
        },
        secondary: {
          position: "前台接待",
          matchScore: 70,
          reasoning: "",
          industries: [],
          culture: "",
          teamRole: "",
        },
      },
      resumeDiagnosis: null,
      advice: {
        topThree: [
          { title: "完善简历", detail: "", deadline: "" },
          { title: "练习面试", detail: "", deadline: "" },
          { title: "拓展渠道", detail: "", deadline: "" },
        ],
      },
    };

    const card = reportSummaryCard("task-1", "report-uuid", report, poleLabels);
    expect(card.type).toBe("report_summary");
    if (card.type !== "report_summary") return;
    expect(card.fourDim).toHaveLength(4);
    expect(card.fourDim[0].left).toBe("内敛");
    expect(card.fourDim[0].right).toBe("外向");
    expect(card.topThree).toEqual(["完善简历", "练习面试", "拓展渠道"]);
  });
});
