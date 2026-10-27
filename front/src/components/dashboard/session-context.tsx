"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicOrigin, Session } from "@/lib/types";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

/** Public URL of a site host, e.g. https://shop.com/offer (http://x.localhost:3000 locally). */
export function siteUrl(host: string | null | undefined, path = "", origin: PublicOrigin = { scheme: "https", port: "" }): string {
  if (!host) return "";
  return `${origin.scheme}://${host}${origin.port ? `:${origin.port}` : ""}${path}`;
}

/** siteUrl bound to the session's public scheme and port. */
export function useSiteUrl(): (host: string | null | undefined, path?: string) => string {
  const { public_origin } = useSession();
  return (host, path = "") => siteUrl(host, path, public_origin);
}
