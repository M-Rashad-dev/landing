"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";

export type AiOffer = { min: number; bonus: number };

/** GET /dashboard/ai/wallet (back end: Dashboard\AiWalletController). */
export type AiWallet = {
  balance: number;
  free: number;
  paid: number;
  /** What AI calls can use now: the free pot, plus the paid pot on a plan with the AI. */
  spendable: number;
  paid_allowed: boolean;
  packages: number[];
  min: number;
  offers: AiOffer[];
  low_balance: number;
  month: { spent: number; by_feature: Array<{ feature: string; spent: number }> };
  pending: { id: number; number: string | null; status: "open" | "pending_review"; total: number } | null;
};

export const AI_ENTRY_TYPES = ["topup", "bonus", "welcome", "gift", "charge", "adjust"] as const;
export type AiEntryType = (typeof AI_ENTRY_TYPES)[number];

export type AiWalletEntry = {
  id: number;
  type: AiEntryType;
  amount: number;
  balance_after: number;
  feature: string | null;
  description: string | null;
  created_at: string;
};

export const AI_WALLET_KEY = ["ai", "wallet"] as const;
export const useAiWallet = () => useQuery({ queryKey: AI_WALLET_KEY, queryFn: () => api<AiWallet>("/dashboard/ai/wallet") });
export const useAiWalletEntries = (type: string, page: number) =>
  useQuery({
    queryKey: [...AI_WALLET_KEY, "entries", type, page],
    queryFn: () => apiPage<AiWalletEntry>("/dashboard/ai/wallet/entries", { query: { ...(type ? { type } : {}), page } }),
  });

/** The free gift a top-up reaches: the biggest offer whose least amount it covers (back end: AiSettings::bonusFor). */
export function bonusFor(offers: AiOffer[], amount: number): number {
  return [...offers].sort((a, b) => a.min - b.min).reduce((bonus, offer) => (amount >= offer.min ? offer.bonus : bonus), 0);
}
