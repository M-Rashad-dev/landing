"use client";

import * as React from "react";
import type { Session } from "@/lib/types/session";

type ClientSession = Pick<Session, "user" | "tenant" | "plan" | "store_name"> & { storeUrl: string | null };

const SessionContext = React.createContext<ClientSession | null>(null);

/** The signed-in owner, the store and its plan, for client screens (read once by the layout). */
export function SessionProvider({ value, children }: { value: ClientSession; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): ClientSession {
  const session = React.useContext(SessionContext);
  if (!session) throw new Error("useSession outside SessionProvider");
  return session;
}

/** A plan limit: null = unlimited (or no plan info). */
export function usePlanLimit(key: string): number | null {
  const limit = useSession().plan?.limits[key];
  return !limit || limit.unlimited ? null : limit.limit;
}

export function usePlanFeature(key: string): boolean {
  const plan = useSession().plan;
  return plan ? plan.features[key] !== false : true;
}
