import { PLAN_ERROR_CODES, type PlanBlock, type PlanErrorCode } from "./types";

/**
 * The API refused something because of the plan. The client announces it once; the dashboard
 * shows a single upgrade dialog, and the error toast of the same failure is skipped.
 */
export const PLAN_BLOCK_EVENT = "plan:blocked";

let toastMutedUntil = 0;

export function isPlanErrorCode(code: unknown): code is PlanErrorCode {
  return typeof code === "string" && (PLAN_ERROR_CODES as readonly string[]).includes(code);
}

export function announcePlanBlock(block: PlanBlock): void {
  if (typeof window === "undefined") return;
  toastMutedUntil = Date.now() + 1500;
  window.dispatchEvent(new CustomEvent<PlanBlock>(PLAN_BLOCK_EVENT, { detail: block }));
}

/** True right after a plan block was announced (its dialog already explains the error). */
export function isErrorToastMuted(): boolean {
  return Date.now() < toastMutedUntil;
}
