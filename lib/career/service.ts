import { DomainError } from "@/lib/errors";
import { saveResumeFile } from "@/lib/db/files";
import { newId } from "@/lib/ids";
import {
  createTask,
  getActiveTask,
  getTask,
  updateTask,
  type CareerTask,
} from "@/lib/db/repositories/career-tasks";
import {
  insertInterviewAnswer,
  listInterviewAnswers,
} from "@/lib/db/repositories/interview-answers";
import { getProfile, upsertProfile } from "@/lib/db/repositories/profiles";
import {
  listQuizAnswers,
  upsertQuizAnswer,
  type QuizInputMethod,
} from "@/lib/db/repositories/quiz-answers";
import { getResumeFile, insertResumeFile } from "@/lib/db/repositories/resume-files";
import {
  interviewQuestionCard,
  nextUnansweredInterviewId,
  profileFormCard,
  quizQuestionCard,
  reportCtaCard,
  reportStatusCard,
  restartConfirmCard,
  type CardPayload,
} from "./cards";
import { COPY } from "./copy";
import { generateInterviewQuestions, validateAnswerText } from "./interview";
import {
  profileDraftSchema,
  profileInputSchema,
  toJobFormData,
  type ProfileDraft,
  type ProfileInput,
  type ProfileSnapshot,
} from "./profile";
import { QUIZ_BANK_VERSION, QUIZ_QUESTIONS, nextUnansweredQuestionId } from "./quiz-bank";
import { extractProfileHints, parseResume } from "./resume";
import { scoreQuiz } from "./scoring";
import { createReportJob } from "./report/jobs";
import { assertTransition } from "./stages";
import type { InterviewQuestion, InterviewQuestionId, OptionLabel } from "./types";

export type Actor = { userId: string; conversationId: string };

export type StepResult = {
  notices: string[];
  cards: CardPayload[];
  forModel: string;
  jobId?: string;
};

export type AttachResumeInput = {
  buffer: Buffer;
  fileName: string;
  mime: string;
};

function requireActiveTask(actor: Actor): CareerTask {
  const task = getActiveTask(actor.userId, actor.conversationId);
  if (!task) {
    throw new DomainError("NOT_FOUND");
  }
  return task;
}

function parseDraft(task: CareerTask): ProfileDraft {
  return JSON.parse(task.profileDraftJson) as ProfileDraft;
}

function saveDraft(task: CareerTask, draft: ProfileDraft): CareerTask {
  return updateTask(task.id, task.version, {
    profileDraftJson: JSON.stringify(draft),
  });
}

function draftFromProfile(userId: string): ProfileDraft {
  const profile = getProfile(userId);
  if (!profile) return {};
  return {
    identity: profile.identity,
    birthDate: profile.birthDate,
    education: profile.education,
    workYears: profile.workYears,
    targetPosition: profile.targetPosition,
    resumeFileId: profile.resumeFileId,
  };
}

function resumeMetaForDraft(
  userId: string,
  draft: ProfileDraft,
): { fileName: string } | null {
  if (!draft.resumeFileId) return null;
  const file = getResumeFile(userId, draft.resumeFileId);
  return file ? { fileName: file.originalName } : null;
}

function buildSnapshot(
  input: ProfileInput,
  draft: ProfileDraft,
  profileVersion: number,
  userId: string,
): ProfileSnapshot {
  let resumeFileName: string | null = null;
  let resumeStoragePath: string | null = null;
  let resumeText: string | null = null;
  let extractedName: string | null = null;
  let extractedPhone: string | null = null;

  if (draft.resumeFileId) {
    const file = getResumeFile(userId, draft.resumeFileId);
    if (file) {
      resumeFileName = file.originalName;
      resumeStoragePath = file.storagePath;
      resumeText = file.text;
      extractedName = file.extractedName;
      extractedPhone = file.extractedPhone;
    }
  }

  return {
    ...input,
    profileVersion,
    resumeFileId: draft.resumeFileId ?? null,
    resumeFileName,
    resumeStoragePath,
    resumeText,
    extractedName,
    extractedPhone,
  };
}

function parseInterviewQuestions(task: CareerTask): InterviewQuestion[] {
  if (!task.interviewQuestionsJson) {
    throw new DomainError("INTERNAL");
  }
  return JSON.parse(task.interviewQuestionsJson) as InterviewQuestion[];
}

function mergeHints(draft: ProfileDraft, hints: Partial<ProfileInput>): ProfileDraft {
  const next = { ...draft };
  for (const [key, value] of Object.entries(hints)) {
    if (value === undefined) continue;
    if (next[key as keyof ProfileDraft] === undefined) {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

export function ensureActiveTask(actor: Actor): CareerTask {
  const existing = getActiveTask(actor.userId, actor.conversationId);
  if (existing) return existing;

  const draft = draftFromProfile(actor.userId);
  const taskId = createTask({
    userId: actor.userId,
    conversationId: actor.conversationId,
    quizBankVersion: QUIZ_BANK_VERSION,
    profileDraftJson: JSON.stringify(draft),
  });
  const task = getTask(actor.userId, taskId);
  if (!task) {
    throw new DomainError("INTERNAL");
  }
  return task;
}

export function showCurrentStep(actor: Actor): StepResult {
  const task = requireActiveTask(actor);
  const draft = parseDraft(task);

  switch (task.stage) {
    case "profile":
      return {
        notices: [],
        cards: [profileFormCard(task.id, draft, resumeMetaForDraft(actor.userId, draft))],
        forModel: "已向用户展示档案确认卡。",
      };
    case "quiz": {
      const answers = listQuizAnswers(task.id);
      const answeredIds = new Set(answers.map((a) => a.questionId));
      const nextId = nextUnansweredQuestionId(answeredIds);
      if (!nextId) {
        throw new DomainError("STAGE_MISMATCH");
      }
      return {
        notices: [],
        cards: [quizQuestionCard(task.id, nextId)],
        forModel: `已向用户展示测评题 ${nextId}。`,
      };
    }
    case "interview": {
      const questions = parseInterviewQuestions(task);
      const answers = listInterviewAnswers(task.id);
      const answeredIds = new Set(answers.map((a) => a.questionId));
      const nextId = nextUnansweredInterviewId(answeredIds);
      if (!nextId) {
        throw new DomainError("STAGE_MISMATCH");
      }
      return {
        notices: [],
        cards: [interviewQuestionCard(task.id, nextId, questions)],
        forModel: `已向用户展示访谈题 ${nextId}。`,
      };
    }
    case "ready_for_report":
      return {
        notices: [],
        cards: [reportCtaCard(task.id)],
        forModel: "已向用户展示生成报告按钮。",
      };
    default:
      throw new DomainError("STAGE_MISMATCH");
  }
}

export function proposeProfile(
  actor: Actor,
  partial: Partial<ProfileInput>,
): StepResult {
  const task = requireActiveTask(actor);
  if (task.stage !== "profile") {
    throw new DomainError("STAGE_MISMATCH");
  }

  const draft = parseDraft(task);
  const invalidLabels: string[] = [];
  const fieldLabels: Record<string, string> = {
    identity: "身份",
    birthDate: "出生年月",
    education: "学历",
    workYears: "工作年限",
    targetPosition: "目标岗位",
  };

  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) continue;
    const parsed = profileDraftSchema.safeParse({ [key]: value });
    if (parsed.success && parsed.data[key as keyof ProfileDraft] !== undefined) {
      (draft as Record<string, unknown>)[key] = parsed.data[key as keyof ProfileDraft];
    } else {
      invalidLabels.push(fieldLabels[key] ?? key);
    }
  }

  const updated = saveDraft(task, draft);
  const forModel =
    invalidLabels.length > 0
      ? `已更新档案草稿；${invalidLabels.join("、")}格式不对，请用户在卡片上修正。`
      : "已更新档案草稿，请用户检查卡片并点击确认。";

  return {
    notices: [],
    cards: [
      profileFormCard(
        updated.id,
        draft,
        resumeMetaForDraft(actor.userId, draft),
      ),
    ],
    forModel,
  };
}

export async function attachResume(
  actor: Actor,
  file: AttachResumeInput,
): Promise<StepResult> {
  const task = requireActiveTask(actor);
  if (task.stage !== "profile") {
    throw new DomainError("STAGE_MISMATCH");
  }

  const parsed = await parseResume(file.buffer, file.fileName, file.mime);
  const ext = file.fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
  const fileId = newId();
  const storagePath = saveResumeFile(actor.userId, fileId, ext, file.buffer);

  insertResumeFile(
    actor.userId,
    {
    originalName: file.fileName,
    mime: file.mime,
    sizeBytes: file.buffer.length,
    storagePath,
    text: parsed.text,
    charCount: parsed.charCount,
    truncated: parsed.truncated,
    extractedName: parsed.extractedName,
    extractedPhone: parsed.extractedPhone,
    },
    fileId,
  );

  const hints = await extractProfileHints(parsed.text, actor.conversationId);
  let draft = parseDraft(task);
  draft = mergeHints(draft, hints);
  draft.resumeFileId = fileId;
  const updated = saveDraft(task, draft);

  const hasHints = Object.keys(hints).length > 0;
  return {
    notices: [
      hasHints
        ? COPY.resumeReceived(file.fileName)
        : COPY.resumeReceivedNoHints(file.fileName),
    ],
    cards: [
      profileFormCard(
        updated.id,
        draft,
        { fileName: file.fileName },
      ),
    ],
    forModel: hasHints
      ? "已读取简历并预填档案，请用户检查卡片并确认。"
      : "已收到简历，请用户补全档案并确认。",
  };
}

export function confirmProfile(actor: Actor, input: ProfileInput): StepResult {
  const task = requireActiveTask(actor);
  if (task.stage !== "profile") {
    throw new DomainError("STAGE_MISMATCH");
  }

  const parsed = profileInputSchema.parse(input);
  const draft = parseDraft(task);
  const profile = upsertProfile(actor.userId, {
    ...parsed,
    resumeFileId: draft.resumeFileId ?? null,
  });
  const snapshot = buildSnapshot(parsed, draft, profile.version, actor.userId);

  assertTransition("profile", "quiz");
  updateTask(task.id, task.version, {
    stage: "quiz",
    profileSnapshotJson: JSON.stringify(snapshot),
  });

  return {
    notices: [COPY.profileConfirmed],
    cards: [quizQuestionCard(task.id, QUIZ_QUESTIONS[0].id)],
    forModel: "档案已确认，已向用户展示第一题测评。",
  };
}

export async function answerQuiz(
  actor: Actor,
  input: {
    questionId: string;
    optionLabel: OptionLabel;
    inputMethod: QuizInputMethod;
  },
): Promise<StepResult> {
  const task = requireActiveTask(actor);
  if (task.stage !== "quiz") {
    throw new DomainError("STAGE_MISMATCH");
  }

  if (!QUIZ_QUESTIONS.some((q) => q.id === input.questionId)) {
    throw new DomainError("INVALID_INPUT");
  }
  if (!["A", "B", "C", "D"].includes(input.optionLabel)) {
    throw new DomainError("INVALID_INPUT");
  }

  upsertQuizAnswer(task.id, {
    questionId: input.questionId,
    optionLabel: input.optionLabel,
    inputMethod: input.inputMethod,
  });

  const answers = listQuizAnswers(task.id);
  const answeredIds = new Set(answers.map((a) => a.questionId));

  if (answeredIds.size < QUIZ_QUESTIONS.length) {
    const nextId = nextUnansweredQuestionId(answeredIds);
    if (!nextId) {
      throw new DomainError("INTERNAL");
    }
    return {
      notices: [],
      cards: [quizQuestionCard(task.id, nextId)],
      forModel: `已记录 ${input.questionId} 的答案，请用户继续下一题。`,
    };
  }

  const quizAnswers = QUIZ_QUESTIONS.map((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    return {
      questionId: q.id,
      selectedLabel: answer!.optionLabel,
    };
  });
  const scoring = scoreQuiz(quizAnswers, QUIZ_QUESTIONS);
  let current = updateTask(task.id, task.version, {
    scoringJson: JSON.stringify(scoring),
  });

  if (!current.profileSnapshotJson) {
    throw new DomainError("INTERNAL");
  }
  const snapshot = JSON.parse(current.profileSnapshotJson) as ProfileSnapshot;
  const formData = toJobFormData(snapshot);
  const questions = await generateInterviewQuestions(
    formData,
    actor.conversationId,
  );

  current = updateTask(current.id, current.version, {
    stage: "interview",
    interviewQuestionsJson: JSON.stringify(questions),
  });

  return {
    notices: [COPY.quizDone],
    cards: [interviewQuestionCard(current.id, "Q1", questions)],
    forModel: "测评已完成，已向用户展示第一题访谈。",
  };
}

export function answerInterview(
  actor: Actor,
  input: {
    questionId: InterviewQuestionId;
    text: string;
    inputMethod: "card" | "chat" | "voice";
  },
): StepResult {
  const task = requireActiveTask(actor);
  if (task.stage !== "interview") {
    throw new DomainError("STAGE_MISMATCH");
  }

  const questions = parseInterviewQuestions(task);
  const answers = listInterviewAnswers(task.id);
  const answeredIds = new Set(answers.map((a) => a.questionId));
  const nextId = nextUnansweredInterviewId(answeredIds);
  if (input.questionId !== nextId) {
    throw new DomainError("STAGE_MISMATCH");
  }

  const answerText = validateAnswerText(input.text);
  insertInterviewAnswer(task.id, {
    questionId: input.questionId,
    answerText,
    inputMethod: input.inputMethod,
  });
  answeredIds.add(input.questionId);

  if (answeredIds.size < 4) {
    const followingId = nextUnansweredInterviewId(answeredIds);
    if (!followingId) {
      throw new DomainError("INTERNAL");
    }
    return {
      notices: [],
      cards: [interviewQuestionCard(task.id, followingId, questions)],
      forModel: `已记录 ${input.questionId} 的回答，请用户继续下一题。`,
    };
  }

  assertTransition("interview", "ready_for_report");
  updateTask(task.id, task.version, { stage: "ready_for_report" });

  return {
    notices: [COPY.interviewDone],
    cards: [reportCtaCard(task.id)],
    forModel: "访谈已完成，请用户点击生成报告。",
  };
}

export function requestRestart(actor: Actor): StepResult {
  const task = requireActiveTask(actor);
  if (task.stage === "profile") {
    throw new DomainError("STAGE_MISMATCH");
  }
  if (task.stage === "report_generating") {
    throw new DomainError("REPORT_IN_PROGRESS");
  }

  return {
    notices: [COPY.restartAsk],
    cards: [restartConfirmCard(task.id)],
    forModel: "已向用户展示重新开始确认卡。",
  };
}

export function confirmRestart(actor: Actor): StepResult {
  const task = requireActiveTask(actor);
  if (task.stage === "profile") {
    throw new DomainError("STAGE_MISMATCH");
  }
  if (task.stage === "report_generating") {
    throw new DomainError("REPORT_IN_PROGRESS");
  }

  updateTask(task.id, task.version, { status: "abandoned" });
  const draft = draftFromProfile(actor.userId);
  const newTaskId = createTask({
    userId: actor.userId,
    conversationId: actor.conversationId,
    quizBankVersion: QUIZ_BANK_VERSION,
    profileDraftJson: JSON.stringify(draft),
  });

  return {
    notices: [COPY.restartDone],
    cards: [
      profileFormCard(newTaskId, draft, resumeMetaForDraft(actor.userId, draft)),
    ],
    forModel: "已重新开始，请用户确认档案。",
  };
}

export function cancelRestart(actor: Actor): StepResult {
  const step = showCurrentStep(actor);
  return {
    notices: [COPY.restartCancelled],
    cards: step.cards,
    forModel: "用户选择继续当前进度。",
  };
}

export function requestReport(
  actor: Actor,
  meta: { ip?: string; userAgent?: string },
): StepResult {
  const jobId = createReportJob(actor, meta);
  const task = requireActiveTask(actor);
  return {
    notices: [COPY.reportStarted],
    cards: [reportStatusCard(task.id, jobId, "generating")],
    forModel: "报告已开始生成，请用户等待。",
    jobId,
  };
}
