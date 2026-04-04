import type { AppError } from "../shared/types";

export function createError(
  code: string,
  message: string,
  recoverable = true,
  detail?: string,
): AppError {
  return { code, message, recoverable, detail };
}

export function fromUnknown(
  code: string,
  message: string,
  error: unknown,
  recoverable = true,
): AppError {
  return createError(
    code,
    message,
    recoverable,
    error instanceof Error ? error.message : String(error),
  );
}
