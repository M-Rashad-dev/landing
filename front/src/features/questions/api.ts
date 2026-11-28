"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiPage, type Paginated } from "@/lib/api/client";

export const QUESTION_TABS = ["all", "unanswered", "published", "hidden"] as const;
export type QuestionTab = (typeof QUESTION_TABS)[number];
export type QuestionStatus = Exclude<QuestionTab, "all">;

/** The longest answer (back end: ProductQuestions::ANSWER_MAX). */
export const ANSWER_MAX = 2000;

/** back end: ProductQuestions::row */
export type QuestionRow = {
  id: number;
  name: string;
  phone: string | null;
  question: string;
  answer: string | null;
  answered_at: string | null;
  is_published: boolean;
  status: QuestionStatus;
  created_at: string;
  product: { id: number; name: string; slug: string; image: Record<string, string> | null; deleted: boolean } | null;
};

export type QuestionFilters = { tab: QuestionTab; q: string; page: number };
type QuestionPage = Paginated<QuestionRow> & { meta: Paginated<QuestionRow>["meta"] & { counts: Record<QuestionTab, number>; enabled: boolean } };

export const questionsKey = ["questions"] as const;

export function useQuestions(f: QuestionFilters) {
  return useQuery({
    queryKey: [...questionsKey, f],
    queryFn: () => apiPage<QuestionRow>("/dashboard/questions", { query: { status: f.tab === "all" ? null : f.tab, q: f.q, page: f.page } }) as Promise<QuestionPage>,
    placeholderData: keepPreviousData,
  });
}

export const saveQuestion = (id: number, body: { answer?: string | null; is_published?: boolean }) => api<QuestionRow>(`/dashboard/questions/${id}`, { method: "PATCH", body });
export const deleteQuestion = (id: number) => api<null>(`/dashboard/questions/${id}`, { method: "DELETE" });
export const setQuestionsEnabled = (enabled: boolean) => api<{ enabled: boolean }>("/dashboard/questions/settings", { method: "PUT", body: { enabled } });
