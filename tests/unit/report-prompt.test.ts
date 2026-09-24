import { describe, expect, it } from "vitest";
import { buildBaseContext } from "@/lib/career/report/baseline";
import {
  buildMegaSystemPrompt,
  buildMegaUserPrompt,
} from "@/lib/career/report/prompt";
import {
  collectAllOverviewText,
  detectReverseWords,
  getTendency,
  tendencyChip,
} from "@/lib/career/report/tendency";
import type { DimensionScore, Overview, ScoringResult } from "@/lib/career/types";
import { scoreQuiz } from "@/lib/career/scoring";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";

function makeFourDim(scores: {
  personality?: number;
  workstyle?: number;
  value?: number;
  direction?: number;
}): DimensionScore[] {
  return [
    { dimension: "personality", name: "性格底色", score: scores.personality ?? 50 },
    { dimension: "workstyle", name: "工作风格", score: scores.workstyle ?? 50 },
    { dimension: "value", name: "价值驱动", score: scores.value ?? 50 },
    { dimension: "direction", name: "适配方向", score: scores.direction ?? 50 },
  ];
}

describe("buildBaseContext", () => {
  it("labels education/work years and truncates resume", () => {
    const resume = "x".repeat(2000);
    const text = buildBaseContext({
      identity: "general_job_seeker",
      education: "bachelor",
      workYears: "1to3",
      targetPosition: "",
      resumeText: resume,
    });
    expect(text).toContain("学历：本科");
    expect(text).toContain("工作年限：1-3年（含）");
    expect(text).toContain("目标岗位：未填写");
    expect(text).toContain("<resume>");
    expect(text).toContain("</resume>");
    expect(text).toContain("(已截断)");
  });
});

describe("buildMegaSystemPrompt", () => {
  it("includes resume module only when hasResume", () => {
    expect(buildMegaSystemPrompt(false).toLowerCase()).toContain("json");
    expect(buildMegaSystemPrompt(false)).not.toContain("【模块 ④ resumeDiagnosis");
    expect(buildMegaSystemPrompt(true)).toContain("【模块 ④ resumeDiagnosis");
    expect(buildMegaSystemPrompt(true).toLowerCase()).toContain("json");
  });
});

describe("getTendency", () => {
  it("≤40 偏左", () => {
    expect(getTendency(0)).toBe("left");
    expect(getTendency(40)).toBe("left");
  });
  it("41-60 较均衡", () => {
    expect(getTendency(41)).toBe("center");
    expect(getTendency(50)).toBe("center");
    expect(getTendency(60)).toBe("center");
  });
  it("≥61 偏右", () => {
    expect(getTendency(61)).toBe("right");
    expect(getTendency(100)).toBe("right");
  });
});

describe("tendencyChip", () => {
  it("价值驱动偏右 → 偏探索", () => {
    expect(tendencyChip(75, "value")).toBe("偏探索");
  });
  it("价值驱动偏左 → 偏稳定", () => {
    expect(tendencyChip(20, "value")).toBe("偏稳定");
  });
  it("价值驱动均衡 → 较均衡", () => {
    expect(tendencyChip(50, "value")).toBe("较均衡");
  });
});

describe("detectReverseWords", () => {
  it("价值驱动偏探索，性格定位含「稳健务实」→ 冲突", () => {
    const fourDim = makeFourDim({ value: 72 });
    const text = "稳健务实型执行者 吃苦耐劳 善于合作 学习力强 踏实肯干";
    const conflicts = detectReverseWords(text, fourDim);
    expect(conflicts.length).toBeGreaterThan(0);
    const valueConflict = conflicts.find((c) => c.dimension === "value");
    expect(valueConflict).toBeDefined();
    expect(valueConflict!.tendency).toBe("right");
    expect(valueConflict!.hits).toEqual(
      expect.arrayContaining(["稳健", "务实", "踏实肯干"]),
    );
  });
});

describe("collectAllOverviewText", () => {
  it("包含全部 overview 文本字段", () => {
    const o: Overview = {
      personality: {
        type: "成长开拓者",
        traits: ["进取", "灵活", "多元"],
        description: "描述文本",
      },
      fourDimRadar: [
        { name: "性格底色", score: 70, conclusion: "底色结论" },
        { name: "工作风格", score: 80, conclusion: "风格结论" },
        { name: "价值驱动", score: 70, conclusion: "价值结论" },
        { name: "适配方向", score: 65, conclusion: "方向结论" },
      ],
      summary: "总结文本",
    };
    const text = collectAllOverviewText(o);
    expect(text).toContain("成长开拓者");
    expect(text).toContain("总结文本");
    expect(text).toContain("价值结论");
  });
});

describe("buildMegaUserPrompt", () => {
  it("includes scoring lines", () => {
    const scoring = scoreQuiz(
      QUIZ_QUESTIONS.map((q) => ({ questionId: q.id, selectedLabel: "A" })),
      QUIZ_QUESTIONS,
    );
    const prompt = buildMegaUserPrompt(
      {
        identity: "recent_grad",
        education: "bachelor",
        workYears: "lt1",
        targetPosition: "行政专员",
      },
      scoring,
      { Q1: "回答1" },
    );
    expect(prompt).toContain("性格四维评分");
    expect(prompt.toLowerCase()).toContain("json");
  });
});
