import { z } from "zod";
import {
  answerInterview,
  answerQuiz,
  proposeProfile,
  requestRestart,
  showCurrentStep,
  type Actor,
  type StepResult,
} from "@/lib/career/service";
import { QUIZ_QUESTION_IDS } from "@/lib/career/quiz-bank";
import { TOOLS_BY_STAGE } from "@/lib/career/stages";
import type { Stage } from "@/lib/career/types";
import type { NeutralTool, ToolCall } from "@/lib/llm/types";
import { loadAgentContext } from "./prompt";

const TOOL_DEFS: NeutralTool[] = [
  {
    name: "show_current_step",
    description:
      "重新展示当前步骤的卡片（档案卡、当前测评题、当前访谈题、生成报告按钮或报告状态）。用户说“继续”“开始”“下一题”，或需要让用户看到当前卡片时调用。",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "propose_profile",
    description:
      "把用户在对话中明确说出的就业档案信息填入档案确认卡，供用户检查后自己点击确认。只填用户明确说过的字段，不要猜测。",
    parameters: {
      type: "object",
      properties: {
        identity: {
          type: "string",
          enum: ["recent_grad", "general_job_seeker"],
          description:
            "recent_grad=应届毕业生（毕业后尚未找到第一份工作）；general_job_seeker=一般社会求职者（有工作经历，正在求职）",
        },
        birthDate: {
          type: "string",
          description: "出生年月，格式 YYYY-MM，例如 2003-05",
        },
        education: {
          type: "string",
          enum: [
            "junior_high",
            "high_school",
            "junior_college",
            "bachelor",
            "master_plus",
          ],
          description:
            "junior_high=初中及以下；high_school=高中/中专/技校；junior_college=高职/大专；bachelor=本科；master_plus=硕士及以上",
        },
        workYears: {
          type: "string",
          enum: ["lt1", "1to3", "3to10", "gt10"],
          description:
            "lt1=0-1年（含）；1to3=1-3年（含）；3to10=3-10年（含）；gt10=10年以上",
        },
        targetPosition: {
          type: "string",
          description: "目标岗位，60 字以内",
        },
      },
    },
  },
  {
    name: "record_quiz_answer",
    description:
      "测评阶段：用户用文字回答了测评题，且能明确对应到某一个选项时，记录这个选项。对应不清时不要调用。",
    parameters: {
      type: "object",
      properties: {
        questionId: { type: "string", enum: [...QUIZ_QUESTION_IDS] },
        optionLabel: { type: "string", enum: ["A", "B", "C", "D"] },
      },
      required: ["questionId", "optionLabel"],
    },
  },
  {
    name: "record_interview_answer",
    description:
      "访谈阶段：用户最新这条消息是在回答当前访谈题时调用。系统会原样保存用户这条消息作为答案，你不需要也不能改写答案。",
    parameters: {
      type: "object",
      properties: {
        questionId: { type: "string", enum: ["Q1", "Q2", "Q3", "Q4"] },
      },
      required: ["questionId"],
    },
  },
  {
    name: "request_restart",
    description:
      "用户明确要求重新开始职业导航或重新测评时调用。系统会展示确认卡片，由用户自己确认。",
    parameters: { type: "object", properties: {} },
  },
];

const proposeProfileSchema = z
  .object({
    identity: z.enum(["recent_grad", "general_job_seeker"]).optional(),
    birthDate: z.string().optional(),
    education: z
      .enum([
        "junior_high",
        "high_school",
        "junior_college",
        "bachelor",
        "master_plus",
      ])
      .optional(),
    workYears: z.enum(["lt1", "1to3", "3to10", "gt10"]).optional(),
    targetPosition: z.string().optional(),
  })
  .strict();

const recordQuizSchema = z
  .object({
    questionId: z.enum(QUIZ_QUESTION_IDS),
    optionLabel: z.enum(["A", "B", "C", "D"]),
  })
  .strict();

const recordInterviewSchema = z
  .object({
    questionId: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  })
  .strict();

export function toolDefsFor(stage: Stage): NeutralTool[] {
  const allowed = new Set(TOOLS_BY_STAGE[stage]);
  return TOOL_DEFS.filter((t) => allowed.has(t.name as never));
}

export type ToolExecutionResult =
  | { ok: true; stage: Stage; result: StepResult; systemCopy: string }
  | { ok: false; code: string; result: string };

export function toolResultForModel(r: ToolExecutionResult): Record<string, unknown> {
  if (!r.ok) {
    return { ok: false, code: r.code, result: r.result };
  }
  return {
    ok: true,
    stage: r.stage,
    result: r.result.forModel,
    systemCopy: r.result.notices.join(" "),
  };
}

export async function executeTool(
  call: ToolCall,
  actor: Actor,
  ctx: ReturnType<typeof loadAgentContext>,
  opts?: { userText?: string },
): Promise<ToolExecutionResult> {
  const stage = ctx.task.stage;
  if (!TOOLS_BY_STAGE[stage].includes(call.name as never)) {
    return { ok: false, code: "TOOL_NOT_ALLOWED", result: "当前阶段不允许此操作" };
  }

  try {
    switch (call.name) {
      case "show_current_step": {
        const result = showCurrentStep(actor);
        return {
          ok: true,
          stage: ctx.task.stage,
          result,
          systemCopy: result.notices.join(" "),
        };
      }
      case "propose_profile": {
        const parsed = proposeProfileSchema.safeParse(call.args);
        if (!parsed.success) {
          return {
            ok: false,
            code: "INVALID_ARGUMENTS",
            result: parsed.error.message,
          };
        }
        const result = proposeProfile(actor, parsed.data);
        return {
          ok: true,
          stage: ctx.task.stage,
          result,
          systemCopy: result.notices.join(" "),
        };
      }
      case "record_quiz_answer": {
        const parsed = recordQuizSchema.safeParse(call.args);
        if (!parsed.success) {
          return {
            ok: false,
            code: "INVALID_ARGUMENTS",
            result: parsed.error.message,
          };
        }
        const result = await answerQuiz(actor, {
          ...parsed.data,
          inputMethod: "chat",
        });
        const refreshed = loadAgentContext(actor);
        return {
          ok: true,
          stage: refreshed.task.stage,
          result,
          systemCopy: result.notices.join(" "),
        };
      }
      case "record_interview_answer": {
        const parsed = recordInterviewSchema.safeParse(call.args);
        if (!parsed.success) {
          return {
            ok: false,
            code: "INVALID_ARGUMENTS",
            result: parsed.error.message,
          };
        }
        const text = opts?.userText ?? "";
        const result = answerInterview(actor, {
          questionId: parsed.data.questionId,
          text,
          inputMethod: "chat",
        });
        const refreshed = loadAgentContext(actor);
        return {
          ok: true,
          stage: refreshed.task.stage,
          result,
          systemCopy: result.notices.join(" "),
        };
      }
      case "request_restart": {
        if (Object.keys(call.args).length > 0) {
          return {
            ok: false,
            code: "INVALID_ARGUMENTS",
            result: "不接受额外参数",
          };
        }
        const result = requestRestart(actor);
        return {
          ok: true,
          stage: ctx.task.stage,
          result,
          systemCopy: result.notices.join(" "),
        };
      }
      default:
        return { ok: false, code: "TOOL_NOT_ALLOWED", result: "未知工具" };
    }
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const e = err as { code: string; message?: string };
      return { ok: false, code: e.code, result: e.message ?? e.code };
    }
    throw err;
  }
}
