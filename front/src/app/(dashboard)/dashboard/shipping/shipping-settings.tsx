"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Truck } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.shipping;

type Rate = { governorate: string; fee: number | null; is_available: boolean };
type Settings = { enabled: boolean; default_fee: number; free_over: number | null; rates: Rate[] };

const KEY = ["shipping"] as const;

export function ShippingSettings() {
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: KEY, queryFn: () => api<Settings>("/dashboard/shipping") });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  // Remount on new server data so the form starts from it.
  return <ShippingForm key={JSON.stringify(data)} initial={data} />;
}

/** Form state uses strings for the money inputs ("" = default / none). */
function ShippingForm({ initial }: { initial: Settings }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [defaultFee, setDefaultFee] = useState(String(initial.default_fee));
  const [freeOver, setFreeOver] = useState(initial.free_over === null ? "" : String(initial.free_over));
  const [rates, setRates] = useState(initial.rates.map((r) => ({ ...r, feeText: r.fee === null ? "" : String(r.fee) })));
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const patch = (governorate: string, change: Partial<(typeof rates)[number]>) => setRates((list) => list.map((r) => (r.governorate === governorate ? { ...r, ...change } : r)));
  const closed = rates.filter((r) => !r.is_available).length;
  const visible = rates.filter((r) => r.governorate.includes(search.trim()));
  const dirty =
    enabled !== initial.enabled ||
    defaultFee !== String(initial.default_fee) ||
    freeOver !== (initial.free_over === null ? "" : String(initial.free_over)) ||
    rates.some((r, i) => r.is_available !== initial.rates[i]?.is_available || r.feeText !== (initial.rates[i]?.fee === null ? "" : String(initial.rates[i]?.fee)));

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const saved = await api<Settings>("/dashboard/shipping", {
        method: "PUT",
        body: {
          enabled,
          default_fee: defaultFee.trim() || "0",
          free_over: freeOver.trim() === "" ? null : freeOver.trim(),
          rates: rates.map((r) => ({ governorate: r.governorate, fee: r.feeText.trim() === "" ? null : r.feeText.trim(), is_available: r.is_available })),
        },
      });
      queryClient.setQueryData(KEY, saved);
      toast.success(t.saved);
    } catch (err) {
      if (isApiError(err) && err.isValidation) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0] ?? ""])));
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      <Card className="flex flex-col gap-5 p-5">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="flex items-center gap-2 font-semibold">
              <Truck className="size-4 text-primary" aria-hidden />
              {t.enabled}
            </span>
            <span className="text-sm text-muted-foreground">{t.enabledHint}</span>
          </span>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t.enabled} />
        </label>
        <div className={cn("grid gap-4 transition-opacity sm:grid-cols-2", !enabled && "pointer-events-none opacity-50")}>
          <FormField label={`${t.defaultFee} (${ar.common.currency})`} htmlFor="ship-default" hint={t.defaultHint} error={errors.default_fee}>
            <Input id="ship-default" inputMode="decimal" dir="ltr" className="text-start" value={defaultFee} onChange={(e) => setDefaultFee(e.target.value)} />
          </FormField>
          <FormField label={`${t.freeOver} (${ar.common.currency})`} htmlFor="ship-free" hint={t.freeOverHint} error={errors.free_over}>
            <Input id="ship-free" inputMode="decimal" dir="ltr" className="text-start" placeholder="—" value={freeOver} onChange={(e) => setFreeOver(e.target.value)} />
          </FormField>
        </div>
      </Card>

      <Card className={cn("overflow-hidden p-0 transition-opacity", !enabled && "pointer-events-none opacity-50")}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <p className="text-sm text-muted-foreground">{t.closedCount(closed)}</p>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} aria-label={t.search} className="ps-9" />
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_8rem_5.5rem] items-center gap-x-4 border-b bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground">
          <span>{t.governorate}</span>
          <span>{t.fee}</span>
          <span className="text-center">{t.available}</span>
        </div>
        <ul className="divide-y">
          {visible.map((rate) => {
            const index = rates.findIndex((r) => r.governorate === rate.governorate);
            return (
              <li key={rate.governorate} className={cn("grid grid-cols-[minmax(0,1fr)_8rem_5.5rem] items-center gap-x-4 px-4 py-2.5 transition-colors", !rate.is_available && "bg-muted/40")}>
                <span className={cn("text-sm font-medium", !rate.is_available && "text-muted-foreground line-through")}>{rate.governorate}</span>
                <Input
                  inputMode="decimal"
                  dir="ltr"
                  aria-label={`${t.fee} — ${rate.governorate}`}
                  aria-invalid={Boolean(errors[`rates.${index}.fee`])}
                  disabled={!rate.is_available}
                  placeholder={formatPrice(Number(defaultFee) || 0)}
                  value={rate.feeText}
                  onChange={(e) => patch(rate.governorate, { feeText: e.target.value })}
                  className="h-9 text-start"
                />
                <span className="flex justify-center">
                  <Switch checked={rate.is_available} onCheckedChange={(checked) => patch(rate.governorate, { is_available: checked })} aria-label={`${t.available} — ${rate.governorate}`} />
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Save bar stays in reach on long lists. */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button size="lg" onClick={() => void save()} loading={saving} disabled={!dirty} className="shadow-lg">
          {ar.common.save}
        </Button>
      </div>
    </div>
  );
}
