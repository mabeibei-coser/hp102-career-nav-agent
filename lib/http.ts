import { DomainError, INTERNAL_ERROR_DEFAULT } from "./errors";

export type ErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type ErrorResponse = {
  status: number;
  body: ErrorBody;
};

export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof DomainError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.message,
        },
      },
    };
  }

  console.error(err);
  return {
    status: INTERNAL_ERROR_DEFAULT.status,
    body: {
      error: {
        code: "INTERNAL",
        message: INTERNAL_ERROR_DEFAULT.message,
      },
    },
  };
}
