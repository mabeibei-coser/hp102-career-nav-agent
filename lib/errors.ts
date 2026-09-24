export type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_ANSWER"
  | "NOT_FOUND"
  | "BUSY"
  | "STAGE_MISMATCH"
  | "VERSION_CONFLICT"
  | "REPORT_IN_PROGRESS"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "RESUME_UNREADABLE"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "LLM_UNAVAILABLE";

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "输入内容不符合要求",
  INVALID_ANSWER: "可以再多说几句",
  NOT_FOUND: "没有找到对应内容",
  BUSY: "上一条还在处理中，请稍等",
  STAGE_MISMATCH: "这一步已经完成了，请看最新的卡片",
  VERSION_CONFLICT: "内容刚刚更新过，请刷新页面",
  REPORT_IN_PROGRESS: "报告正在生成，请等生成完成后再操作",
  FILE_TOO_LARGE: "文件不能超过 5MB",
  UNSUPPORTED_FILE: "只支持 PDF 或 Word（.docx）文件",
  RESUME_UNREADABLE: "没能读取这份简历，可以换一个文件，或直接填写档案继续",
  RATE_LIMITED: "发送太频繁了，请稍后再试",
  INTERNAL: "服务出了点问题，请稍后再试",
  LLM_UNAVAILABLE: "服务繁忙，请稍后再试。你也可以直接点击卡片继续。",
};

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  INVALID_ANSWER: 400,
  NOT_FOUND: 404,
  BUSY: 409,
  STAGE_MISMATCH: 409,
  VERSION_CONFLICT: 409,
  REPORT_IN_PROGRESS: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  RESUME_UNREADABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  LLM_UNAVAILABLE: 503,
};

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message?: string, status?: number) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.code = code;
    this.status = status ?? DEFAULT_STATUS[code];
    this.name = "DomainError";
  }
}

export const INTERNAL_ERROR_DEFAULT = {
  status: DEFAULT_STATUS.INTERNAL,
  message: DEFAULT_MESSAGES.INTERNAL,
};
