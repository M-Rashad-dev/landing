"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** conversion is null when there were no tracked visits. */
export type Totals = { views: number; form_starts: number; orders: number; revenue: number; conversion: number | null };

export type AnalyticsReport = {
  from: string;
  to: string;
  totals: Totals;
  daily: Array<{ date: string; views: number; orders: number }>;
  pages: Array<Totals & { id: number; title: string; slug: string | null; deleted: boolean }>;
  sources: Array<{ source: string; views: number; orders: number }>;
  devices: { mobile: number; desktop: number };
};

export type Verdict = { state: "collecting" | "too_close" | "winner"; leader: "a" | "b" | null; confidence: number; lift: number | null };

export type AbTestPage = { id: number; title: string; slug: string; published: boolean };

export type AbTest = {
  /** Above the plan limit after a downgrade: kept, not served to visitors. */
  locked_by_plan?: boolean;
  id: number;
  name: string;
  status: "running" | "finished";
  split_a: number;
  page_a: AbTestPage | null;
  page_b: AbTestPage | null;
  winner_page_id: number | null;
  started_at: string;
  ended_at: string | null;
  results: { a: Totals; b: Totals; verdict: Verdict };
};

export const analyticsKeys = {
  report: (params: { from: string; to: string; page_id: string }) => ["analytics", params] as const,
  tests: ["ab-tests"] as const,
};

export function useAnalytics(params: { from: string; to: string; page_id: string }) {
  return useQuery({
    queryKey: analyticsKeys.report(params),
    queryFn: ({ signal }) => api<AnalyticsReport>("/dashboard/analytics", { query: { from: params.from, to: params.to, page_id: params.page_id || undefined }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useAbTests() {
  return useQuery({ queryKey: analyticsKeys.tests, queryFn: () => api<AbTest[]>("/dashboard/ab-tests"), refetchInterval: 60_000 });
}

export const createAbTest = (payload: { name: string; page_a_id: number; page_b_id: number; split_a: number }) => api<AbTest>("/dashboard/ab-tests", { method: "POST", body: payload });
export const finishAbTest = (id: number, winnerPageId: number | null) => api<AbTest>(`/dashboard/ab-tests/${id}/finish`, { method: "POST", body: { winner_page_id: winnerPageId } });
export const deleteAbTest = (id: number) => api<void>(`/dashboard/ab-tests/${id}`, { method: "DELETE" });
