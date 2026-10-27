import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { serverApi } from "@/lib/api/server";
import { serverEnv } from "@/lib/env";
import { isApiError } from "@/lib/api/errors";
import type { Session } from "@/lib/types";

/** Current user (deduplicated per request). Redirects to login when the token is invalid. */
export const getSession = cache(async (): Promise<Session> => {
  try {
    const me = await serverApi<Omit<Session, "public_origin">>("/auth/me");
    const env = serverEnv();
    return { ...me, public_origin: { scheme: env.publicScheme, port: env.publicPort } };
  } catch (error) {
    if (isApiError(error) && (error.status === 401 || error.status === 403)) {
      redirect("/api/auth/expired");
    }
    throw error;
  }
});
