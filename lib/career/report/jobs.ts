import { DomainError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { withTransaction } from "@/lib/db/client";
import { insertMessages } from "@/lib/db/repositories/messages";
import { listInterviewAnswers } from "@/lib/db/repositories/interview-answers";
import { listQuizAnswers } from "@/lib/db/repositories/quiz-answers";
import {
  getActiveTask,
  getTask,
  updateTask,
  type CareerTask,
} from "@/lib/db/repositories/career-tasks";
import {
  countJobsSince,
  getJob,
  insertJob,
  listJobsByStatus,
  updateJob,
} from "@/lib/db/repositories/report-jobs";
import { insertReport } from "@/lib/db/repositories/reports";
import { generateJson } from "@/lib/llm/generate-json";
import { LlmError } from "@/lib/llm/types";
import { reportLimiter } from "@/lib/llm/limiter";
import { reportStatusCard, reportSummaryCard } from "../cards";
import { COPY } from "../copy";
import { toJobFormData, type ProfileSnapshot } from "../profile";
import { QUIZ_QUESTIONS } from "../quiz-bank";
import { assertTransition } from "../stages";
import type { Actor, StepResult } from "../service";
import type { InterviewQ1Q2, ReportData, ScoringResult } from "../types";
import { buildMegaSystemPrompt, buildMegaUserPrompt } from "./prompt";
import {
  normalizeEmploymentIndex,
  normalizeOverview,
  normalizePositioning,
  normalizeStrength,
  patchAdvice,
} from "./normalize";
import {
  buildReportRetryHook,
  buildReportValidator,
  type AllSections,
} from "./validate";

const ERROR_MESSAGES: Record<string, string> = {
  timeout: "生成超时了",
  validation_failed: "生成的内容没有通过质量检查",
  invalid_json: "生成的内容没有通过质量检查",
  blocked: "生成的内容没有通过安全检查",
  rate_limited: "服务繁忙，请稍后重试",
  INTERRUPTED: "服务重启，生成被中断",
};

function userErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "生成服务暂时不可用";
}

export function createReportJob(
  actor: Actor,
  meta: { ip?: string; userAgent?: string },
): string {
  const current = getActiveTask(actor.userId, actor.conversationId);
  if (!current) throw new DomainError("NOT_FOUND");
  if (current.stage !== "ready_for_report" && current.stage !== "report_failed") {
    throw new DomainError("STAGE_MISMATCH");
  }

  const since = Date.now() - 24 * 60 * 60 * 1000;
  if (countJobsSince(actor.userId, since) >= 5) {
    throw new DomainError(
      "RATE_LIMITED",
      "今天生成报告的次数已达上限，请明天再试",
    );
  }

  return withTransaction(() => {
    const jobId = insertJob({
      careerTaskId: current.id,
      userId: actor.userId,
      conversationId: actor.conversationId,
      status: "queued",
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
    assertTransition(current.stage, "report_generating");
    updateTask(current.id, current.version, { stage: "report_generating" });
    return jobId;
  });
}

export async function runReportJob(jobId: string): Promise<void> {
  try {
    await reportLimiter.run(async () => {
      const job = getJob(jobId);
      if (!job || job.status !== "queued") return;

      const startedAt = Date.now();
      updateJob(jobId, { status: "generating", startedAt });

      const task = getTask(job.userId, job.careerTaskId);
      if (!task || !task.profileSnapshotJson || !task.scoringJson) {
        throw new LlmError("provider_error", "任务数据不完整");
      }

      const snapshot = JSON.parse(task.profileSnapshotJson) as ProfileSnapshot;
      const scoring = JSON.parse(task.scoringJson) as ScoringResult;
      const formData = toJobFormData(snapshot);
      const hasResume = (formData.resumeText ?? "").trim().length >= 50;
      const answers = listInterviewAnswers(task.id);
      const q1q2: InterviewQ1Q2 = {
        Q1: answers.find((a) => a.questionId === "Q1")?.answerText,
        Q2: answers.find((a) => a.questionId === "Q2")?.answerText,
      };

      const userPrompt = buildMegaUserPrompt(formData, scoring, q1q2);
      const { data, provider, model } = await generateJson<AllSections>({
        purpose: "report",
        conversationId: job.conversationId,
        system: buildMegaSystemPrompt(hasResume),
        user: userPrompt,
        maxOutputTokens: 16384,
        temperature: 0.6,
        timeoutMs: 90000,
        validator: buildReportValidator(hasResume, scoring),
        onValidationFailure: buildReportRetryHook(scoring, userPrompt),
      });

      normalizeOverview(data.overview, scoring);
      normalizeStrength(data.strength, scoring);
      normalizePositioning(data.positioning);
      data.advice = patchAdvice(data.advice);
      const employmentIndex = normalizeEmploymentIndex(data.employmentIndex);

      const reportUuid = newId();
      const finishedAt = Date.now();
      const quizAnswers = listQuizAnswers(task.id);
      const quizAnswersJson = QUIZ_QUESTIONS.map((q) => ({
        questionId: q.id,
        selectedLabel:
          quizAnswers.find((a) => a.questionId === q.id)?.optionLabel ?? "A",
      }));

      const reportData: ReportData = {
        meta: {
          generatedAt: new Date().toISOString(),
          formData,
          scoring,
          hasResume,
          interviewQ1Q2: q1q2,
        },
        overview: data.overview,
        strength: data.strength,
        positioning: data.positioning,
        resumeDiagnosis: hasResume ? data.resumeDiagnosis : null,
        advice: data.advice,
        employmentIndex,
      };

      withTransaction(() => {
        insertReport({
          createdAt: finishedAt,
          uuid: reportUuid,
          userId: job.userId,
          userPhone: snapshot.extractedPhone,
          conversationId: job.conversationId,
          careerTaskId: task.id,
          userIdentity: snapshot.identity,
          targetPosition: snapshot.targetPosition,
          targetEducation: snapshot.education,
          hasResume,
          resumeFilename: snapshot.resumeFileName,
          resumeStoragePath: snapshot.resumeStoragePath,
          sectionsStatus: JSON.stringify({
            overview: "done",
            strength: "done",
            positioning: "done",
            resumeDiagnosis: hasResume ? "done" : "skipped",
            advice: "done",
          }),
          ip: job.ip,
          userAgent: job.userAgent,
          durationMs: finishedAt - startedAt,
          formDataJson: JSON.stringify(formData),
          quizAnswersJson: JSON.stringify(quizAnswersJson),
          scoringJson: JSON.stringify(scoring),
          interviewQ1q2Json: JSON.stringify({
            Q1: q1q2.Q1 ?? "",
            Q2: q1q2.Q2 ?? "",
          }),
          interviewQ3q4Json: JSON.stringify({
            Q3: answers.find((a) => a.questionId === "Q3")?.answerText ?? "",
            Q4: answers.find((a) => a.questionId === "Q4")?.answerText ?? "",
          }),
          interviewQuestionsJson: task.interviewQuestionsJson ?? "[]",
          reportJson: JSON.stringify(reportData),
          modelProvider: provider,
          modelName: model,
        });

        updateJob(jobId, {
          status: "ready",
          reportUuid,
          provider,
          model,
          finishedAt,
        });

        const latest = getTask(job.userId, task.id);
        if (!latest) throw new DomainError("INTERNAL");
        assertTransition(latest.stage, "report_ready");
        updateTask(latest.id, latest.version, {
          stage: "report_ready",
          latestReportUuid: reportUuid,
        });

        insertMessages(job.conversationId, [
          { role: "notice", content: { kind: "text", text: COPY.reportReady } },
          {
            role: "card",
            content: {
              kind: "card",
              card: reportSummaryCard(task.id, reportUuid, reportData),
            },
          },
        ]);
      });
    });
  } catch (err) {
    const job = getJob(jobId);
    if (!job) return;

    const code =
      err instanceof LlmError
        ? err.category === "validation_failed"
          ? "validation_failed"
          : err.category
        : err instanceof Error && err.message === "INTERRUPTED"
          ? "INTERRUPTED"
          : "provider_error";

    const task = getTask(job.userId, job.careerTaskId);
    if (!task) return;

    withTransaction(() => {
      updateJob(jobId, {
        status: "failed",
        errorCode: code,
        finishedAt: Date.now(),
      });
      const latest = getTask(job.userId, task.id);
      if (latest && latest.stage === "report_generating") {
        updateTask(latest.id, latest.version, { stage: "report_failed" });
      }
      insertMessages(job.conversationId, [
        {
          role: "notice",
          content: { kind: "text", text: COPY.reportFailed },
        },
        {
          role: "card",
          content: {
            kind: "card",
            card: reportStatusCard(
              task.id,
              jobId,
              "failed",
              userErrorMessage(code),
            ),
          },
        },
      ]);
    });
  }
}

export function recoverInterruptedReportJobs(): void {
  const jobs = listJobsByStatus(["queued", "generating"]);
  for (const job of jobs) {
    const task = getTask(job.userId, job.careerTaskId);
    if (!task) continue;

    withTransaction(() => {
      updateJob(job.id, {
        status: "failed",
        errorCode: "INTERRUPTED",
        finishedAt: Date.now(),
      });
      const latest = getTask(job.userId, task.id);
      if (latest && latest.stage === "report_generating") {
        updateTask(latest.id, latest.version, { stage: "report_failed" });
      }
      insertMessages(job.conversationId, [
        {
          role: "notice",
          content: { kind: "text", text: COPY.reportInterrupted },
        },
        {
          role: "card",
          content: {
            kind: "card",
            card: reportStatusCard(
              task.id,
              job.id,
              "failed",
              userErrorMessage("INTERRUPTED"),
            ),
          },
        },
      ]);
    });
  }
}
