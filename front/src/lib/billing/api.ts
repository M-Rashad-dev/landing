"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { EntitlementInfo, LockRow, PlanLimitKey, PricingPlan, SubscriptionRow, UsageRow } from "./types";

export const billingKeys = {
  usage: (keys: string) => ["billing", "usage", keys] as const,
  plans: ["billing", "plans"] as const,
  subscriptions: ["billing", "subscriptions"] as const,
  locks: (limit: PlanLimitKey) => ["billing", "locks", limit] as const,
};

/** Usage of some limits (all when empty). Counting happens server-side, so ask only for what the screen shows. */
export function useUsage(keys: PlanLimitKey[] = []) {
  const joined = keys.join(",");
  return useQuery({
    queryKey: billingKeys.usage(joined),
    queryFn: () => api<UsageRow[]>("/dashboard/billing/usage", { query: { keys: joined || undefined } }),
    staleTime: 15_000,
  });
}

export function useBillingPlans() {
  return useQuery({
    queryKey: billingKeys.plans,
    queryFn: async () => {
      const res = await apiPage<PricingPlan>("/dashboard/billing/plans");
      return { plans: res.data, entitlements: (res.meta as unknown as { entitlements: EntitlementInfo[] }).entitlements };
    },
  });
}

export function useSubscriptions() {
  return useQuery({ queryKey: billingKeys.subscriptions, queryFn: () => api<SubscriptionRow[]>("/dashboard/billing/subscriptions") });
}

export function useLockRows(limit: PlanLimitKey, enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.locks(limit),
    enabled,
    queryFn: async () => {
      const res = await apiPage<LockRow>(`/dashboard/billing/locks/${limit}`);
      return { rows: res.data, limit: Number((res.meta as unknown as { limit: number }).limit) };
    },
  });
}

export function chooseLocks(limit: PlanLimitKey, activeIds: number[]) {
  return api<LockRow[]>(`/dashboard/billing/locks/${limit}`, { method: "PUT", body: { active_ids: activeIds } });
}
