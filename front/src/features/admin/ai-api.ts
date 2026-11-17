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
