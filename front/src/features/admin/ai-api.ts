import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** The AI settings (back end: App\Ai\AiSettings). */
export type AiSettings = {
  features: Record<string, boolean>;
  daily_cap_usd: number;
  usd_rate: number | null;
  margin_percent: number;
  support_daily_messages: number;
};

type Totals = { calls: number; usd: number; failed: number };

/** GET /admin/ai: settings, connection, models and what the AI cost. */
export type AiOverview = {
  settings: AiSettings;
  status: { configured: boolean; driver: string; paused_until: string | null; today_usd: number; limit_reached: boolean };
  models: Array<{ model: string; priced: boolean }>;
  usage: {
    today: Totals;
    month: Totals;
    by_feature: Array<{ feature: string; calls: number; usd: number }>;
    top_stores: Array<{ tenant_id: number; name: string; calls: number; usd: number }>;
    failures: Array<{ at: string; feature: string; model: string; error: string | null }>;
  };
};

export const AI_KEY = ["admin", "ai"] as const;
export const useAiOverview = () => useQuery({ queryKey: AI_KEY, queryFn: () => api<AiOverview>("/admin/ai") });
export const saveAiSettings = (settings: AiSettings) => api<AiOverview>("/admin/ai/settings", { method: "PUT", body: settings });

/** A knowledge-base article of «مساعد مكسب» (back end: AiArticleController). */
export type AiArticle = {
  id: number;
  title: string;
  category: string;
  body: string;
  is_active: boolean;
  pieces: number;
  /** ready = the assistant reads it; waiting = being prepared (or the assistant is off); failed = will retry. */
  state: "ready" | "waiting" | "failed";
  error: string | null;
  updated_at: string | null;
};
export type AiArticleInput = Pick<AiArticle, "title" | "category" | "body" | "is_active">;

export const ARTICLES_KEY = ["admin", "ai", "articles"] as const;
export const useAiArticles = () => useQuery({ queryKey: ARTICLES_KEY, queryFn: () => api<AiArticle[]>("/admin/ai/articles") });
export const saveAiArticle = (id: number | null, input: AiArticleInput) =>
  id === null ? api<AiArticle>("/admin/ai/articles", { method: "POST", body: input }) : api<AiArticle>(`/admin/ai/articles/${id}`, { method: "PUT", body: input });
export const deleteAiArticle = (id: number) => api<void>(`/admin/ai/articles/${id}`, { method: "DELETE" });
