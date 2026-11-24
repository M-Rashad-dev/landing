"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";

export type ExpenseKind = "ads_facebook" | "ads_tiktok" | "ads_google" | "ads_snapchat" | "ads_other" | "salaries" | "rent" | "tools" | "other";

type Totals = { orders: number; revenue: number; refunds?: number; product_cost: number; shipping_cost: number; cod_fee: number; packaging: number; losses: number; profit: number };

/** back end: App\Analytics\ProfitReport */
export type ProfitData = {
  from: string;
  to: string;
  actual: Totals;
  expected: Totals;
  expenses: { total: number; by_kind: Array<{ kind: ExpenseKind; label: string; amount: number }> };
  net_profit: number;
  margin: number | null;
  /** Refunds done in the period (by the day the money went back). */
  refunds?: { count: number; total: number };
  missing_cost_orders: number;
  chart: Array<{ date: string; profit: number; expenses: number; net: number }>;
  products: Array<{ product_id: number | null; name: string; units: number; revenue: number; cost: number; profit: number; margin: number | null; cost_known: boolean }>;
  sources: Array<{ source: string; orders: number; revenue: number; profit: number; ad_spend: number; net: number; roas: number | null }>;
};

export type Expense = { id: number; spent_on: string; kind: ExpenseKind; kind_label: string; amount: number; note: string | null };
export type ExpenseInput = { spent_on: string; kind: ExpenseKind; amount: string; note: string | null };
export type ProfitSettings = { packaging_cost: number; kinds: Array<{ value: ExpenseKind; label: string; is_ads: boolean }> };

export const profitKeys = { all: ["profit"] as const };

export function useProfit(from: string, to: string) {
  return useQuery({ queryKey: [...profitKeys.all, "report", from, to], queryFn: () => api<ProfitData>("/dashboard/profit", { query: { from, to } }), placeholderData: keepPreviousData });
}

export function useExpenses(from: string, to: string, page: number) {
  return useQuery({
    queryKey: [...profitKeys.all, "expenses", from, to, page],
    queryFn: () => apiPage<Expense>("/dashboard/profit/expenses", { query: { from, to, page, per_page: 20 } }),
    placeholderData: keepPreviousData,
  });
}

export function useProfitSettings() {
  return useQuery({ queryKey: [...profitKeys.all, "settings"], queryFn: () => api<ProfitSettings>("/dashboard/profit/settings") });
}

export function useRefreshProfit() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: profitKeys.all });
}

export const saveExpense = (body: ExpenseInput, id?: number) => api<Expense>(id ? `/dashboard/profit/expenses/${id}` : "/dashboard/profit/expenses", { method: id ? "PUT" : "POST", body });
export const deleteExpense = (id: number) => api<void>(`/dashboard/profit/expenses/${id}`, { method: "DELETE" });
export const savePackaging = (packaging_cost: string) => api<ProfitSettings>("/dashboard/profit/settings", { method: "PUT", body: { packaging_cost } });
