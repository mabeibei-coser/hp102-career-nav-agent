CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  next_seq INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  seq INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'notice', 'card')),
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (conversation_id, seq)
);

CREATE TABLE resume_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0,
  extracted_name TEXT,
  extracted_phone TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_resume_files_user ON resume_files(user_id, created_at DESC);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  identity TEXT NOT NULL CHECK (identity IN ('recent_grad', 'general_job_seeker')),
  birth_date TEXT NOT NULL,
  education TEXT NOT NULL CHECK (education IN ('junior_high', 'high_school', 'junior_college', 'bachelor', 'master_plus')),
  work_years TEXT NOT NULL CHECK (work_years IN ('lt1', '1to3', '3to10', 'gt10')),
  target_position TEXT NOT NULL DEFAULT '',
  resume_file_id TEXT REFERENCES resume_files(id),
  version INTEGER NOT NULL,
  confirmed_at INTEGER NOT NULL
);

CREATE TABLE career_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'abandoned')),
  stage TEXT NOT NULL CHECK (stage IN ('profile', 'quiz', 'interview', 'ready_for_report', 'report_generating', 'report_ready', 'report_failed')),
  version INTEGER NOT NULL DEFAULT 1,
  profile_draft_json TEXT NOT NULL DEFAULT '{}',
  profile_snapshot_json TEXT,
  quiz_bank_version TEXT NOT NULL,
  scoring_json TEXT,
  interview_questions_json TEXT,
  latest_report_uuid TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_career_tasks_one_active ON career_tasks(conversation_id) WHERE status = 'active';

CREATE TABLE quiz_answers (
  career_task_id TEXT NOT NULL REFERENCES career_tasks(id),
  question_id TEXT NOT NULL,
  option_label TEXT NOT NULL CHECK (option_label IN ('A', 'B', 'C', 'D')),
  input_method TEXT NOT NULL CHECK (input_method IN ('button', 'chat')),
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (career_task_id, question_id)
);

CREATE TABLE interview_answers (
  career_task_id TEXT NOT NULL REFERENCES career_tasks(id),
  question_id TEXT NOT NULL CHECK (question_id IN ('Q1', 'Q2', 'Q3', 'Q4')),
  answer_text TEXT NOT NULL,
  input_method TEXT NOT NULL CHECK (input_method IN ('card', 'chat', 'voice')),
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (career_task_id, question_id)
);

CREATE TABLE report_jobs (
  id TEXT PRIMARY KEY,
  career_task_id TEXT NOT NULL REFERENCES career_tasks(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  status TEXT NOT NULL CHECK (status IN ('queued', 'generating', 'ready', 'failed')),
  error_code TEXT,
  report_uuid TEXT,
  provider TEXT,
  model TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX idx_report_jobs_user ON report_jobs(user_id, created_at DESC);
CREATE INDEX idx_report_jobs_status ON report_jobs(status);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  uuid TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  user_phone TEXT,
  conversation_id TEXT NOT NULL,
  career_task_id TEXT NOT NULL,
  user_identity TEXT,
  target_position TEXT NOT NULL DEFAULT '',
  target_education TEXT,
  has_resume INTEGER NOT NULL DEFAULT 0,
  resume_filename TEXT,
  resume_storage_path TEXT,
  sections_status TEXT,
  ip TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  form_data_json TEXT NOT NULL,
  quiz_answers_json TEXT NOT NULL,
  scoring_json TEXT NOT NULL,
  interview_q1q2_json TEXT NOT NULL,
  interview_q3q4_json TEXT NOT NULL,
  interview_questions_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'
);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_user ON reports(user_id, created_at DESC);

CREATE TABLE llm_calls (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('chat', 'json')),
  purpose TEXT NOT NULL CHECK (purpose IN ('chat', 'interview_questions', 'resume_hints', 'report', 'smoke', 'eval')),
  step INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  error_category TEXT,
  finish_reason TEXT,
  latency_ms INTEGER NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_llm_calls_created ON llm_calls(created_at DESC);
