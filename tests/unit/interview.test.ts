import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { LlmError, type JsonProvider } from "@/lib/llm/types";
import {
  FALLBACK_Q1Q2,
  FIXED_QUESTIONS_POOL,
  buildInterviewUserPrompt,
  generateInterviewQuestions,
  validateAnswerText,
} from "@/lib/career/interview";

describe("interview", () => {
  it("generates 4 questions with dynamic Q1/Q2 and fixed Q3/Q4", async () => {
    const provider: JsonProvider = {
      provider: "mock",
      model: "mock",
      async completeJsonText() {
        return {
          text: JSON.stringify({
            questions: [
              {
                id: "Q1",
                text: "能具体说说你在上一份工作中负责的主要项目吗？",
                source: "dynamic",
              },
              {
                id: "Q2",
                text: "你希望下一份工作在工作方式上有什么变化？",
                source: "dynamic",
              },
            ],
          }),
          finishReason: "STOP",
        };
      },
    };

    const questions = await generateInterviewQuestions(
      {
        identity: "recent_grad",
        education: "bachelor",
        workYears: "lt1",
        targetPosition: "行政专员",
      },
      "conv-1",
      { provider },
    );

    expect(questions.map((q) => q.id)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(questions[0].source).toBe("dynamic");
    expect(questions[1].source).toBe("dynamic");
    expect(questions[2].source).toBe("fixed");
    expect(questions[3].source).toBe("fixed");
    expect(questions[2].text).not.toBe(questions[3].text);
    expect(FIXED_QUESTIONS_POOL.some((q) => q.text === questions[2].text)).toBe(
      true,
    );
    expect(FIXED_QUESTIONS_POOL.some((q) => q.text === questions[3].text)).toBe(
      true,
    );
  });

  it("falls back to FALLBACK_Q1Q2 when provider fails", async () => {
    const provider: JsonProvider = {
      provider: "mock",
      model: "mock",
      async completeJsonText() {
        throw new LlmError("provider_error", "provider failed");
      },
    };

    const questions = await generateInterviewQuestions(
      {
        identity: "general_job_seeker",
        education: "bachelor",
        workYears: "1to3",
        targetPosition: "",
      },
      "conv-2",
      { provider },
    );

    expect(questions[0].text).toBe(FALLBACK_Q1Q2[0].text);
    expect(questions[1].text).toBe(FALLBACK_Q1Q2[1].text);
    expect(questions[0].source).toBe("dynamic_fallback");
    expect(questions[1].source).toBe("dynamic_fallback");
  });

  it("builds user prompt labels and validates answers", () => {
    const prompt = buildInterviewUserPrompt({
      identity: "recent_grad",
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "",
    });

    expect(prompt).toContain("学历：本科");
    expect(prompt).toContain("工作年限：0-1年（含）");
    expect(prompt).toContain("目标岗位：未填写");
    expect(prompt).toContain("简历内容：未上传");

    expect(() => validateAnswerText(" 好 ")).toThrow(DomainError);
    expect(validateAnswerText("好的")).toBe("好的");
  });
});
