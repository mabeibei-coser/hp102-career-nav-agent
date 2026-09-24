import { describe, expect, it } from "vitest";
import { LlmError, type JsonProvider } from "@/lib/llm/types";
import { extractProfileHints, parseResume } from "@/lib/career/resume";
import { makeResumeDocx } from "../fixtures/make-resume-docx";

describe("resume", () => {
  it("parses default docx resume", async () => {
    const buf = await makeResumeDocx();
    const parsed = await parseResume(
      buf,
      "简历.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(parsed.text).toContain("行政专员");
    expect(parsed.extractedPhone).toBe("13800138000");
  });

  it("rejects oversized, unsupported, and unreadable files", async () => {
    await expect(
      parseResume(
        Buffer.alloc(5 * 1024 * 1024 + 1),
        "big.pdf",
        "application/pdf",
      ),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });

    await expect(
      parseResume(Buffer.from("x"), "a.doc", "application/msword"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE" });

    const empty = await makeResumeDocx([]);
    await expect(
      parseResume(
        empty,
        "empty.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).rejects.toMatchObject({ code: "RESUME_UNREADABLE" });
  });

  it("extracts profile hints and drops invalid fields on provider error", async () => {
    const provider: JsonProvider = {
      provider: "mock",
      model: "mock",
      async completeJsonText() {
        return {
          text: JSON.stringify({
            education: "bachelor",
            workYears: "99",
            targetPosition: "行政专员",
          }),
          finishReason: "STOP",
        };
      },
    };

    const hints = await extractProfileHints("简历正文", "conv-1", { provider });
    expect(hints).toEqual({
      education: "bachelor",
      targetPosition: "行政专员",
    });

    const failing: JsonProvider = {
      provider: "mock",
      model: "mock",
      async completeJsonText() {
        throw new LlmError("provider_error", "failed");
      },
    };
    await expect(
      extractProfileHints("简历正文", "conv-2", { provider: failing }),
    ).resolves.toEqual({});
  });
});
