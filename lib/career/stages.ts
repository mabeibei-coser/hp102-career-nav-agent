import { DomainError } from "../errors";
import type { Stage } from "./types";

export type ToolName =
  | "show_current_step"
  | "propose_profile"
  | "record_quiz_answer"
  | "record_interview_answer"
  | "request_restart";

export type ActionName =
  | "confirm_profile"
  | "answer_quiz"
  | "answer_interview"
  | "generate_report"
  | "confirm_restart"
  | "cancel_restart";

const ALLOWED_TRANSITIONS: Record<Stage, Stage[]> = {
  profile: ["quiz"],
  quiz: ["interview"],
  interview: ["ready_for_report"],
  ready_for_report: ["report_generating"],
  report_generating: ["report_ready", "report_failed"],
  report_failed: ["report_generating"],
  report_ready: [],
};

export function assertTransition(from: Stage, to: Stage): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new DomainError("STAGE_MISMATCH");
  }
}

export const TOOLS_BY_STAGE: Record<Stage, ToolName[]> = {
  profile: ["show_current_step", "propose_profile"],
  quiz: ["show_current_step", "record_quiz_answer", "request_restart"],
  interview: ["show_current_step", "record_interview_answer", "request_restart"],
  ready_for_report: ["show_current_step", "request_restart"],
  report_generating: ["show_current_step"],
  report_failed: ["show_current_step", "request_restart"],
  report_ready: ["show_current_step", "request_restart"],
};

export const ACTIONS_BY_STAGE: Record<Stage, ActionName[]> = {
  profile: ["confirm_profile"],
  quiz: ["answer_quiz", "confirm_restart", "cancel_restart"],
  interview: ["answer_interview", "confirm_restart", "cancel_restart"],
  ready_for_report: ["generate_report", "confirm_restart", "cancel_restart"],
  report_generating: [],
  report_failed: ["generate_report", "confirm_restart", "cancel_restart"],
  report_ready: ["confirm_restart", "cancel_restart"],
};
