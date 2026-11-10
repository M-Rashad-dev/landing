"use client";

import type { ReactNode } from "react";
import { PlanBanner, UpgradeDialog } from "@/components/billing/plan";
import { OrderSoundToggle, useOrderNotifications } from "./order-notifications";
import { DashboardShell } from "./shell";

/** Client wrapper for the tenant dashboard shell: order notifications (badge, toast, sound, tab title) and the plan banner / upgrade dialog. */
export function DashboardChrome({ children }: { children: ReactNode }) {
  const { newCount } = useOrderNotifications();
  return (
    <DashboardShell badges={{ orders: newCount }} topbarExtra={<OrderSoundToggle />} banner={<PlanBanner />}>
      {children}
      <UpgradeDialog />
    </DashboardShell>
  );
}
