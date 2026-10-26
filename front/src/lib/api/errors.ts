import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ar } from "@/messages/ar";

export type ApiErrorBody = {
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
  [key: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: Record<string, string[]>;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || ar.errors.generic);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code || (status === 0 ? "network_error" : "http_error");
    this.errors = body.errors ?? {};
    this.body = body;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Human message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 0) return ar.errors.network;
    return error.message || ar.errors.generic;
  }
  return ar.errors.generic;
}

/**
 * Map a Laravel 422 onto react-hook-form fields. Laravel keys use dots
 * (options.0.values.2.label), which react-hook-form understands as paths.
 * Returns the messages that matched no known field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields?: readonly string[],
): string[] {
  if (!isApiError(error) || !error.isValidation) return [];

  const unmatched: string[] = [];
  let focused = false;

  for (const [field, messages] of Object.entries(error.errors)) {
    const message = messages[0];
    if (!message) continue;
    const root = field.split(".")[0];
    if (knownFields && !knownFields.includes(root)) {
      unmatched.push(message);
      continue;
    }
    setError(field as Path<T>, { type: "server", message }, { shouldFocus: !focused });
    focused = true;
  }

  return unmatched;
}
