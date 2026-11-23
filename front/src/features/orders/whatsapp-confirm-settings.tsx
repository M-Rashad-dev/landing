"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import * as React from "react";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";

const t = ar.orders.autoConfirm;
const KEY = ["orders", "confirmation-settings"] as const;

export type ConfirmSettings = {
  available: boolean;
  enabled: boolean;
  delay_minutes: number;
  reminder_hours: number | null;
  final_hours: number;
  on_timeout: "keep" | "cancel";
  stats: Record<"sent" | "reminded" | "confirmed" | "cancelled" | "needs_call" | "no_reply" | "failed", number>;
};

/** «تأكيد الطلبات على واتساب» (free): on / off, timings, and how the last 30 days went. */
export function WhatsAppConfirmSettings() {
  const client = useQueryClient();
  const can = useCan();
  const query = useQuery({ queryKey: KEY, queryFn: () => api<ConfirmSettings>("/dashboard/orders/confirmation-settings") });
  const [saving, setSaving] = React.useState(false);
  if (query.isPending) return <Skeleton className="h-28 rounded-xl" />;
  if (query.isError) return null;
  const s = query.data;
  const editable = can("orders.auto_confirm");

  const save = async (patch: Partial<ConfirmSettings>) => {
    setSaving(true);
    try {
      const next = { ...s, ...patch };
      client.setQueryData(KEY, await api<ConfirmSettings>("/dashboard/orders/confirmation-settings", { method: "PUT", body: { enabled: next.enabled, delay_minutes: next.delay_minutes, reminder_hours: next.reminder_hours, final_hours: next.final_hours, on_timeout: next.on_timeout } }));
      toast.success(t.saved);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const answered = s.stats.confirmed + s.stats.cancelled + s.stats.needs_call;
  const total = answered + s.stats.no_reply + s.stats.failed + s.stats.sent + s.stats.reminded;

  return (
    <Panel>
      <PanelHeader title={<span className="flex items-center gap-2"><MessageCircle className="size-4 text-ink-3" aria-hidden />{t.title}</span>} description={t.description} />
      <PanelBody className="flex flex-col gap-4">
        {!s.available ? <Alert tone="info">{t.unavailable}</Alert> : null}
        <SwitchRow title={t.enabled} description={t.enabledHint} checked={s.enabled} disabled={!editable || saving || !s.available} onCheckedChange={(v) => void save({ enabled: v })} />
        {s.enabled ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t.delay} htmlFor="oc-delay">
              <Select id="oc-delay" disabled={!editable} value={String(s.delay_minutes)} onValueChange={(v) => void save({ delay_minutes: Number(v) })} options={[0, 5, 15, 30, 60].map((m) => ({ value: String(m), label: t.minutes(m) }))} />
            </Field>
            <Field label={t.reminder} htmlFor="oc-reminder">
              <Select id="oc-reminder" disabled={!editable} value={s.reminder_hours === null ? "" : String(s.reminder_hours)} emptyLabel={t.noReminder} onValueChange={(v) => void save({ reminder_hours: v === "" ? null : Number(v) })} options={[2, 4, 6, 12].map((h) => ({ value: String(h), label: t.hours(h) }))} />
            </Field>
            <Field label={t.finalWait} htmlFor="oc-final">
              <Select id="oc-final" disabled={!editable} value={String(s.final_hours)} onValueChange={(v) => void save({ final_hours: Number(v) })} options={[12, 24, 48, 72].map((h) => ({ value: String(h), label: t.hours(h) }))} />
            </Field>
            <Field label={t.onTimeout} htmlFor="oc-timeout">
              <Select id="oc-timeout" disabled={!editable} value={s.on_timeout} onValueChange={(v) => void save({ on_timeout: v as ConfirmSettings["on_timeout"] })} options={[{ value: "keep", label: t.keep }, { value: "cancel", label: t.cancel }]} />
            </Field>
          </div>
        ) : null}
        {total > 0 ? (
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            {(["confirmed", "cancelled", "needs_call", "no_reply", "failed"] as const).map((k) => (
              <div key={k} className="rounded-lg bg-surface-2 p-2">
                <dt className="text-xs text-ink-3">{t.stats[k]}</dt>
                <dd className="font-semibold tabular">{s.stats[k]}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
