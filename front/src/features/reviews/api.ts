"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";

export const REVIEW_TABS = ["all", "visible", "hidden"] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

/** back end: Dashboard\ReviewController::row */
export type ReviewRow = {
  id: number;
  rating: number;
  text: string | null;
  author_name: string;
  is_hidden: boolean;
  created_at: string;
  product: { id: number; name: string; image: Record<string, string> | null; deleted: boolean } | null;
  customer: { id: number; name: string | null; phone: string } | null;
};

export type ReviewFilters = { tab: ReviewTab; rating: number | null; q: string; page: number };
type ReviewPage = Paginated<ReviewRow> & { meta: Paginated<ReviewRow>["meta"] & { counts: Record<ReviewTab, number> & { average: number } } };

export function useReviews(f: ReviewFilters) {
  return useQuery({
    queryKey: ["reviews", f],
    queryFn: () => apiPage<ReviewRow>("/dashboard/reviews", { query: { status: f.tab === "all" ? null : f.tab, rating: f.rating, q: f.q, page: f.page } }) as Promise<ReviewPage>,
    placeholderData: keepPreviousData,
  });
}

export const setReviewHidden = (id: number, hidden: boolean) => api<ReviewRow>(`/dashboard/reviews/${id}`, { method: "PATCH", body: { is_hidden: hidden } });
