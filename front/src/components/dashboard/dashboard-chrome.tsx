"use client";

import type { ReactNode } from "react";
import { DashboardShell } from "./shell";

/** Client wrapper for the tenant dashboard shell (order notifications plug in here). */
export function DashboardChrome({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
