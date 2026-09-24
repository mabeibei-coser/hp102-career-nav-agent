import { describe, it, expect } from "vitest";
import {
  assertTransition,
  TOOLS_BY_STAGE,
  ACTIONS_BY_STAGE,
} from "@/lib/career/stages";
import { DomainError } from "@/lib/errors";
import { COPY } from "@/lib/career/copy";

const HUMAN_IN_LOOP_TOOLS = [
  "confirm_profile",
  "generate_report",
  "confirm_restart",
] as const;

describe("stages", () => {
  it("assertTransition allows valid transitions and rejects invalid ones", () => {
    expect(() => assertTransition("profile", "quiz")).not.toThrow();
    expect(() => assertTransition("report_failed", "report_generating")).not.toThrow();
    expect(() => assertTransition("quiz", "report_generating")).toThrow(DomainError);
    try {
      assertTransition("quiz", "report_generating");
    } catch (e) {
      expect((e as DomainError).code).toBe("STAGE_MISMATCH");
    }
  });

  it("TOOLS_BY_STAGE matches spec and excludes human-in-the-loop tools", () => {
    expect(TOOLS_BY_STAGE.report_generating).toEqual(["show_current_step"]);
    expect(TOOLS_BY_STAGE.profile).toContain("propose_profile");
    expect(TOOLS_BY_STAGE.profile).not.toContain("request_restart");

    for (const tools of Object.values(TOOLS_BY_STAGE)) {
      for (const forbidden of HUMAN_IN_LOOP_TOOLS) {
        expect(tools).not.toContain(forbidden);
      }
    }
  });

  it("ACTIONS_BY_STAGE.report_generating is empty and COPY strings match spec", () => {
    expect(ACTIONS_BY_STAGE.report_generating).toEqual([]);
    expect(COPY.disclaimer).toBe(
      "本报告由 AI 基于公开信息和你的输入生成，仅作为职业定位的参考，不构成就业、岗位匹配或薪资承诺。具体岗位匹配请以上海市公共招聘网或 12333 公共就业服务热线为准。",
    );
    expect(COPY.llmBusy.startsWith("服务繁忙，请稍后再试")).toBe(true);
    expect(COPY.llmBlocked.length).toBeGreaterThan(0);
    expect(COPY.toolLimit.length).toBeGreaterThan(0);
  });
});
