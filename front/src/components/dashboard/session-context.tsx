"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "@/lib/types";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

/** https://{primary_host} (http on *.localhost during development). */
export function siteUrl(host: string | null | undefined, path = ""): string {
  if (!host) return "";
  const isLocal = host === "localhost" || host.endsWith(".localhost");
  const origin = isLocal ? `http://${host}${typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : ""}` : `https://${host}`;
  return `${origin}${path}`;
}
