"use client";

import type { ReactNode } from "react";
import { ADMIN_NAV } from "@/components/dashboard/nav-items";
import { DashboardShell } from "@/components/dashboard/shell";

/** Same shell as the tenant dashboard with the super admin menu. */
export function AdminChrome({ children }: { children: ReactNode }) {
  return <DashboardShell nav={ADMIN_NAV}>{children}</DashboardShell>;
}
