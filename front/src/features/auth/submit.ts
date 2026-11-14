import { ApiError, type ApiErrorBody } from "@/lib/api/errors";
import { postAuth } from "@/lib/auth/redirect";
import type { UserRole } from "@/lib/types/session";

type AuthResult = { user?: { role?: UserRole } };

/** POST to our auth route handler; throws ApiError on failure, returns the user (the token stays in the cookie). */
export async function submitAuth(path: "/api/auth/login" | "/api/auth/register", body: unknown): Promise<AuthResult> {
  let response: Response;
  try {
    response = await postAuth(path, body);
  } catch {
    throw new ApiError(0, {});
  }
  const json = (await response.json().catch(() => ({}))) as ApiErrorBody & { data?: AuthResult };
  if (!response.ok) throw new ApiError(response.status, json);
  return json.data ?? {};
}

/** Where a fresh sign in lands: the platform admin has its own area. */
export function homeFor(role: UserRole | undefined): string {
  return role === "super_admin" ? "/admin" : "/dashboard";
}
