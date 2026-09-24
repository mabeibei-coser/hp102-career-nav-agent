import { getDb } from "../client";

export type InterviewQuestionId = "Q1" | "Q2" | "Q3" | "Q4";
export type InterviewInputMethod = "card" | "chat" | "voice";

export type InterviewAnswer = {
  careerTaskId: string;
  questionId: InterviewQuestionId;
  answerText: string;
  inputMethod: InterviewInputMethod;
  answeredAt: number;
};

export type InterviewAnswerInput = {
  questionId: InterviewQuestionId;
  answerText: string;
  inputMethod: InterviewInputMethod;
};

export function insertInterviewAnswer(
  careerTaskId: string,
  input: InterviewAnswerInput,
): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO interview_answers (career_task_id, question_id, answer_text, input_method, answered_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    careerTaskId,
    input.questionId,
    input.answerText,
    input.inputMethod,
    now,
  );
}

export function listInterviewAnswers(
  careerTaskId: string,
): InterviewAnswer[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT career_task_id, question_id, answer_text, input_method, answered_at
       FROM interview_answers WHERE career_task_id = ? ORDER BY answered_at ASC`,
    )
    .all(careerTaskId) as Array<{
    career_task_id: string;
    question_id: InterviewQuestionId;
    answer_text: string;
    input_method: InterviewInputMethod;
    answered_at: number;
  }>;

  return rows.map((row) => ({
    careerTaskId: row.career_task_id,
    questionId: row.question_id,
    answerText: row.answer_text,
    inputMethod: row.input_method,
    answeredAt: row.answered_at,
  }));
}
