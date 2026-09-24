import { describe, it, expect } from "vitest";
import { scoreQuiz } from "@/lib/career/scoring";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";
import type { QuizQuestion, QuizAnswer } from "@/lib/career/types";

function dimMap(result: ReturnType<typeof scoreQuiz>) {
  return Object.fromEntries(result.fourDim.map((d) => [d.dimension, d.score]));
}

function abilityMap(result: ReturnType<typeof scoreQuiz>) {
  return Object.fromEntries(result.ability.map((a) => [a.key, a.score]));
}

/** 构造覆盖 6 个能力维度的 mock 题库（2 题） */
function makeMockQuestions(): QuizQuestion[] {
  return [
    {
      id: "SJT-01",
      text: "遇到陌生任务，你会怎么做？",
      options: [
        {
          label: "A",
          text: "边做边摸索",
          weights: { learning: 1.0, execution: 0.6 },
        },
        {
          label: "B",
          text: "先列步骤",
          weights: { execution: 1.0, data: 0.6 },
        },
        {
          label: "C",
          text: "找人请教",
          weights: { collaboration: 1.0, communication: 0.6 },
        },
        {
          label: "D",
          text: "主动告知上级",
          weights: { communication: 0.9, stress: 0.5 },
        },
      ],
    },
    {
      id: "SJT-02",
      text: "同时有三项任务，你怎么安排？",
      options: [
        {
          label: "A",
          text: "按紧急排序",
          weights: { execution: 1.0, stress: 0.5 },
        },
        {
          label: "B",
          text: "估算工作量分时间块",
          weights: { execution: 0.9, data: 0.7 },
        },
        {
          label: "C",
          text: "问哪项最优先",
          weights: { communication: 0.9, collaboration: 0.6 },
        },
        {
          label: "D",
          text: "先做能快速完成的",
          weights: { execution: 0.8, learning: 0.4 },
        },
      ],
    },
  ];
}

describe("scoreQuiz (HP102 fixed bank)", () => {
  it("all A → fixed dimension and ability scores", () => {
    const answers: QuizAnswer[] = QUIZ_QUESTIONS.map((q) => ({
      questionId: q.id,
      selectedLabel: "A",
    }));
    const result = scoreQuiz(answers, QUIZ_QUESTIONS);
    const dims = dimMap(result);
    const abilities = abilityMap(result);

    expect(dims.personality).toBe(24);
    expect(dims.workstyle).toBe(24);
    expect(dims.value).toBe(52);
    expect(dims.direction).toBe(26);
    expect(abilities.communication).toBe(0);
    expect(abilities.collaboration).toBe(0);
    expect(abilities.execution).toBe(87);
    expect(abilities.learning).toBe(63);
    expect(abilities.data).toBe(35);
    expect(abilities.stress).toBe(45);
  });

  it("all D → fixed dimension and ability scores", () => {
    const answers: QuizAnswer[] = QUIZ_QUESTIONS.map((q) => ({
      questionId: q.id,
      selectedLabel: "D",
    }));
    const result = scoreQuiz(answers, QUIZ_QUESTIONS);
    const dims = dimMap(result);
    const abilities = abilityMap(result);

    expect(dims.personality).toBe(37);
    expect(dims.workstyle).toBe(52);
    expect(dims.value).toBe(49);
    expect(dims.direction).toBe(64);
    expect(abilities.communication).toBe(36);
    expect(abilities.collaboration).toBe(12);
    expect(abilities.execution).toBe(26);
    expect(abilities.learning).toBe(51);
    expect(abilities.data).toBe(37);
    expect(abilities.stress).toBe(73);
  });

  it("empty answers → all 50", () => {
    const result = scoreQuiz([], QUIZ_QUESTIONS);
    for (const d of result.fourDim) {
      expect(d.score).toBe(50);
    }
    for (const a of result.ability) {
      expect(a.score).toBe(50);
    }
  });
});

describe("scoreQuiz (SJT sparse matrix)", () => {
  it("t1: 两题都选 A → 能力得分能正确累计", () => {
    const questions = makeMockQuestions();
    const answers: QuizAnswer[] = [
      { questionId: "SJT-01", selectedLabel: "A" },
      { questionId: "SJT-02", selectedLabel: "A" },
    ];
    const result = scoreQuiz(answers, questions);

    expect(result.fourDim).toHaveLength(4);
    expect(result.ability).toHaveLength(6);
    for (const d of result.fourDim) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
    for (const a of result.ability) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
    }
  });

  it("t2: 单题选最高权重选项 → 对应能力得分 100", () => {
    const isolatedQ: QuizQuestion[] = [
      {
        id: "ISO-01",
        text: "test",
        options: [
          { label: "A", text: "a", weights: { learning: 1.0 } },
          { label: "B", text: "b", weights: { execution: 1.0 } },
          { label: "C", text: "c", weights: { collaboration: 1.0 } },
          { label: "D", text: "d", weights: { stress: 1.0 } },
        ],
      },
    ];

    const answersA: QuizAnswer[] = [
      { questionId: "ISO-01", selectedLabel: "A" },
    ];
    const resultA = scoreQuiz(answersA, isolatedQ);
    const mapA = Object.fromEntries(resultA.ability.map((a) => [a.key, a.score]));
    expect(mapA.learning).toBe(100);
    expect(mapA.execution).toBe(0);

    const answersB: QuizAnswer[] = [
      { questionId: "ISO-01", selectedLabel: "B" },
    ];
    const resultB = scoreQuiz(answersB, isolatedQ);
    const mapB = Object.fromEntries(resultB.ability.map((a) => [a.key, a.score]));
    expect(mapB.execution).toBe(100);
    expect(mapB.learning).toBe(0);
  });

  it("t3: 无任何题贡献某能力时得分 = 50（默认中性）", () => {
    const noCollabQuestions: QuizQuestion[] = [
      {
        id: "NC-01",
        text: "test",
        options: [
          { label: "A", text: "a", weights: { execution: 1.0 } },
          { label: "B", text: "b", weights: { learning: 1.0 } },
          { label: "C", text: "c", weights: { data: 1.0 } },
          { label: "D", text: "d", weights: { stress: 1.0 } },
        ],
      },
    ];
    const answersNC: QuizAnswer[] = [
      { questionId: "NC-01", selectedLabel: "A" },
    ];
    const resultNC = scoreQuiz(answersNC, noCollabQuestions);
    const abilityMapNC = Object.fromEntries(
      resultNC.ability.map((a) => [a.key, a.score]),
    );

    expect(abilityMapNC.collaboration).toBe(50);
    expect(abilityMapNC.communication).toBe(50);
  });

  it("t4: 不存在的 questionId 跳过不报错", () => {
    const questions = makeMockQuestions();
    const answers: QuizAnswer[] = [
      { questionId: "NOT-EXIST", selectedLabel: "A" },
      { questionId: "SJT-01", selectedLabel: "C" },
    ];
    expect(() => scoreQuiz(answers, questions)).not.toThrow();
    const result = scoreQuiz(answers, questions);
    const abilityMap = Object.fromEntries(
      result.ability.map((a) => [a.key, a.score]),
    );
    expect(abilityMap.collaboration).toBe(100);
  });

  it("t5: 四维雷达从能力分正确推导", () => {
    const questions = makeMockQuestions();
    const answers: QuizAnswer[] = [
      { questionId: "SJT-01", selectedLabel: "C" },
      { questionId: "SJT-02", selectedLabel: "C" },
    ];
    const result = scoreQuiz(answers, questions);

    const abilityMap = Object.fromEntries(
      result.ability.map((a) => [a.key, a.score]),
    );
    const dimMap = Object.fromEntries(
      result.fourDim.map((d) => [d.dimension, d.score]),
    );

    const expectedPersonality = Math.round(
      (abilityMap.communication + abilityMap.collaboration) / 2,
    );
    expect(dimMap.personality).toBe(expectedPersonality);

    for (const d of result.fourDim) {
      expect(d.name).toBeTruthy();
    }
  });

  it("t6: 空答案数组返回全 50 分（无贡献默认中性）", () => {
    const questions = makeMockQuestions();
    const result = scoreQuiz([], questions);
    for (const a of result.ability) {
      expect(a.score).toBe(50);
    }
    for (const d of result.fourDim) {
      expect(d.score).toBe(50);
    }
  });
});
