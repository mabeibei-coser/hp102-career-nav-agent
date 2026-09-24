import { describe, it, expect } from "vitest";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";
import type { AbilityKey } from "@/lib/career/types";

describe("quiz-bank", () => {
  it("has questions in the correct order", () => {
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      "SJT-01",
      "SJT-02",
      "SJT-04",
      "SJT-05",
      "SJT-03",
      "SJT-06",
      "SJT-07",
      "SJT-09",
    ]);
  });

  it("has 2 questions per dimension", () => {
    const counts = {
      personality: 0,
      workstyle: 0,
      value: 0,
      direction: 0,
    };
    for (const q of QUIZ_QUESTIONS) {
      if (q.dimension) counts[q.dimension]++;
    }
    expect(counts).toEqual({
      personality: 2,
      workstyle: 2,
      value: 2,
      direction: 2,
    });
  });

  it("each question has 4 options with poleValue and weights covering all 6 abilities", () => {
    const abilityKeys = new Set<AbilityKey>();
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(4);
      for (const opt of q.options) {
        expect(["A", "B", "C", "D"]).toContain(opt.label);
        expect(typeof opt.poleValue).toBe("number");
        expect(Object.keys(opt.weights).length).toBeGreaterThan(0);
        for (const key of Object.keys(opt.weights) as AbilityKey[]) {
          abilityKeys.add(key);
        }
      }
    }
    expect(abilityKeys.size).toBe(6);
    expect(abilityKeys).toEqual(
      new Set([
        "communication",
        "collaboration",
        "execution",
        "learning",
        "data",
        "stress",
      ]),
    );
  });
});
