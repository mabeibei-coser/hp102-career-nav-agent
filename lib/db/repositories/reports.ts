import { getDb } from "../client";

export type Report = {
  id: number;
  createdAt: number;
  uuid: string;
  userId: string;
  userPhone: string | null;
  conversationId: string;
  careerTaskId: string;
  userIdentity: string | null;
  targetPosition: string;
  targetEducation: string | null;
  hasResume: boolean;
  resumeFilename: string | null;
  resumeStoragePath: string | null;
  sectionsStatus: string | null;
  ip: string | null;
  userAgent: string | null;
  durationMs: number | null;
  formDataJson: string;
  quizAnswersJson: string;
  scoringJson: string;
  interviewQ1q2Json: string;
  interviewQ3q4Json: string;
  interviewQuestionsJson: string;
  reportJson: string;
  modelProvider: string;
  modelName: string;
  status: string;
};

export type InsertReportInput = {
  createdAt: number;
  uuid: string;
  userId: string;
  userPhone?: string | null;
  conversationId: string;
  careerTaskId: string;
  userIdentity?: string | null;
  targetPosition?: string;
  targetEducation?: string | null;
  hasResume?: boolean;
  resumeFilename?: string | null;
  resumeStoragePath?: string | null;
  sectionsStatus?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  durationMs?: number | null;
  formDataJson: string;
  quizAnswersJson: string;
  scoringJson: string;
  interviewQ1q2Json: string;
  interviewQ3q4Json: string;
  interviewQuestionsJson: string;
  reportJson: string;
  modelProvider: string;
  modelName: string;
  status?: string;
};

function rowToReport(row: {
  id: number;
  created_at: number;
  uuid: string;
  user_id: string;
  user_phone: string | null;
  conversation_id: string;
  career_task_id: string;
  user_identity: string | null;
  target_position: string;
  target_education: string | null;
  has_resume: number;
  resume_filename: string | null;
  resume_storage_path: string | null;
  sections_status: string | null;
  ip: string | null;
  user_agent: string | null;
  duration_ms: number | null;
  form_data_json: string;
  quiz_answers_json: string;
  scoring_json: string;
  interview_q1q2_json: string;
  interview_q3q4_json: string;
  interview_questions_json: string;
  report_json: string;
  model_provider: string;
  model_name: string;
  status: string;
}): Report {
  return {
    id: row.id,
    createdAt: row.created_at,
    uuid: row.uuid,
    userId: row.user_id,
    userPhone: row.user_phone,
    conversationId: row.conversation_id,
    careerTaskId: row.career_task_id,
    userIdentity: row.user_identity,
    targetPosition: row.target_position,
    targetEducation: row.target_education,
    hasResume: row.has_resume === 1,
    resumeFilename: row.resume_filename,
    resumeStoragePath: row.resume_storage_path,
    sectionsStatus: row.sections_status,
    ip: row.ip,
    userAgent: row.user_agent,
    durationMs: row.duration_ms,
    formDataJson: row.form_data_json,
    quizAnswersJson: row.quiz_answers_json,
    scoringJson: row.scoring_json,
    interviewQ1q2Json: row.interview_q1q2_json,
    interviewQ3q4Json: row.interview_q3q4_json,
    interviewQuestionsJson: row.interview_questions_json,
    reportJson: row.report_json,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    status: row.status,
  };
}

export function insertReport(input: InsertReportInput): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO reports (
         created_at, uuid, user_id, user_phone, conversation_id, career_task_id,
         user_identity, target_position, target_education, has_resume, resume_filename,
         resume_storage_path, sections_status, ip, user_agent, duration_ms,
         form_data_json, quiz_answers_json, scoring_json, interview_q1q2_json,
         interview_q3q4_json, interview_questions_json, report_json, model_provider,
         model_name, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.createdAt,
      input.uuid,
      input.userId,
      input.userPhone ?? null,
      input.conversationId,
      input.careerTaskId,
      input.userIdentity ?? null,
      input.targetPosition ?? "",
      input.targetEducation ?? null,
      input.hasResume ? 1 : 0,
      input.resumeFilename ?? null,
      input.resumeStoragePath ?? null,
      input.sectionsStatus ?? null,
      input.ip ?? null,
      input.userAgent ?? null,
      input.durationMs ?? null,
      input.formDataJson,
      input.quizAnswersJson,
      input.scoringJson,
      input.interviewQ1q2Json,
      input.interviewQ3q4Json,
      input.interviewQuestionsJson,
      input.reportJson,
      input.modelProvider,
      input.modelName,
      input.status ?? "completed",
    );
  return Number(result.lastInsertRowid);
}

export function getReportByUuid(
  userId: string,
  uuid: string,
): Report | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, created_at, uuid, user_id, user_phone, conversation_id, career_task_id,
              user_identity, target_position, target_education, has_resume, resume_filename,
              resume_storage_path, sections_status, ip, user_agent, duration_ms,
              form_data_json, quiz_answers_json, scoring_json, interview_q1q2_json,
              interview_q3q4_json, interview_questions_json, report_json, model_provider,
              model_name, status
       FROM reports WHERE uuid = ? AND user_id = ?`,
    )
    .get(uuid, userId) as
    | {
        id: number;
        created_at: number;
        uuid: string;
        user_id: string;
        user_phone: string | null;
        conversation_id: string;
        career_task_id: string;
        user_identity: string | null;
        target_position: string;
        target_education: string | null;
        has_resume: number;
        resume_filename: string | null;
        resume_storage_path: string | null;
        sections_status: string | null;
        ip: string | null;
        user_agent: string | null;
        duration_ms: number | null;
        form_data_json: string;
        quiz_answers_json: string;
        scoring_json: string;
        interview_q1q2_json: string;
        interview_q3q4_json: string;
        interview_questions_json: string;
        report_json: string;
        model_provider: string;
        model_name: string;
        status: string;
      }
    | undefined;
  return row ? rowToReport(row) : null;
}
