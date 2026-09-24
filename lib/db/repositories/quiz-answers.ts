import { getDb } from "../client";

export type OptionLabel = "A" | "B" | "C" | "D";
export type QuizInputMethod = "button" | "chat";

export type QuizAnswer = {
  careerTaskId: string;
  questionId: string;
  optionLabel: OptionLabel;
  inputMethod: QuizInputMethod;
  answeredAt: number;
};

export type QuizAnswerInput = {
  questionId: string;
  optionLabel: OptionLabel;
  inputMethod: QuizInputMethod;
};

export function upsertQuizAnswer(
  careerTaskId: string,
  input: QuizAnswerInput,
): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO quiz_answers (career_task_id, question_id, option_label, input_method, answered_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(career_task_id, question_id) DO UPDATE SET
       option_label = excluded.option_label,
       input_method = excluded.input_method,
       answered_at = excluded.answered_at`,
  ).run(
    careerTaskId,
    input.questionId,
    input.optionLabel,
    input.inputMethod,
    now,
  );
}

export function listQuizAnswers(careerTaskId: string): QuizAnswer[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT career_task_id, question_id, option_label, input_method, answered_at
       FROM quiz_answers WHERE career_task_id = ? ORDER BY answered_at ASC`,
    )
    .all(careerTaskId) as Array<{
    career_task_id: string;
    question_id: string;
    option_label: OptionLabel;
    input_method: QuizInputMethod;
    answered_at: number;
  }>;

  return rows.map((row) => ({
    careerTaskId: row.career_task_id,
    questionId: row.question_id,
    optionLabel: row.option_label,
    inputMethod: row.input_method,
    answeredAt: row.answered_at,
  }));
}
