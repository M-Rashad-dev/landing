import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { serverApi } from "@/lib/api/server";
import { isApiError } from "@/lib/api/errors";
import type { Session } from "@/lib/types";

/** Current user (deduplicated per request). Redirects to login when the token is invalid. */
export const getSession = cache(async (): Promise<Session> => {
  try {
    return await serverApi<Session>("/auth/me");
  } catch (error) {
    if (isApiError(error) && (error.status === 401 || error.status === 403)) {
      redirect("/api/auth/expired");
    }
    throw error;
  }
});
