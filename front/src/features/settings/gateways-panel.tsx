"use client";

import { CreditCard, Plug, Unplug } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { StorePayments } from "./payments-page";

const t = ar.settings.payments.gateways;

/** A gateway the store can connect with its own account (back: OnlineStorePayments::overview). */
export type Gateway = {
  key: string;
  label: string;
  fields: Array<{ key: string; secret: boolean; label: string; hint: string }>;
  connected: boolean;
  mode: "test" | "live" | null;
  status: "active" | "failed" | null;
  connected_at: string | null;
  method_id: number | null;
};

/** «الدفع الأونلاين»: Paymob, Kashier, XPay with the merchant's own account; the money goes straight to him. */
export function GatewaysPanel({ gateways, onChange }: { gateways: Gateway[]; onChange: (next: StorePayments) => void }) {
  const can = useCan();
  const manage = can("payments.update");
  const [connecting, setConnecting] = React.useState<Gateway | null>(null);
  const [leaving, setLeaving] = React.useState<Gateway | null>(null);
  const [busy, setBusy] = React.useState(false);

  const disconnect = async () => {
    if (!leaving) return;
    setBusy(true);
    try {
      onChange(await api<StorePayments>(`/dashboard/payments/gateways/${leaving.key}`, { method: "DELETE" }));
      toast.success(t.disconnected(leaving.label));
      setLeaving(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader title={<span className="flex items-center gap-2"><CreditCard className="size-4 text-ink-3" aria-hidden />{t.title}</span>} description={t.hint} />
      <ul className="divide-y divide-border">
        {gateways.map((g) => (
          <li key={g.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {g.label}
                {g.connected ? (
                  <Badge size="sm" tone={g.status === "failed" ? "danger" : g.mode === "live" ? "success" : "attention"} dot>
                    {g.status === "failed" ? t.failed : g.mode === "live" ? t.live : t.test}
                  </Badge>
                ) : null}
              </span>
              <span className="block text-xs text-ink-3">{g.connected && g.connected_at ? t.connectedAt(formatDateTime(g.connected_at)) : t.about[g.key as keyof typeof t.about] ?? ""}</span>
            </span>
            {manage ? (
              g.connected ? (
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConnecting(g)}>
                    {t.update}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLeaving(g)}>
                    <Unplug />
                    {t.disconnect}
                  </Button>
                </span>
              ) : (
                <Button size="sm" onClick={() => setConnecting(g)}>
                  <Plug />
                  {t.connect}
                </Button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      <PanelBody className="pt-0">
        <p className="text-xs text-ink-3">{t.money}</p>
      </PanelBody>
      <ConnectDialog gateway={connecting} onClose={() => setConnecting(null)} onSaved={(next) => (onChange(next), setConnecting(null))} />
      <ConfirmDialog open={leaving !== null} onOpenChange={(o) => !o && setLeaving(null)} title={t.disconnectTitle(leaving?.label ?? "")} description={t.disconnectText} confirmLabel={t.disconnect} destructive loading={busy} onConfirm={() => void disconnect()} />
    </Panel>
  );
}

function ConnectDialog({ gateway, onClose, onSaved }: { gateway: Gateway | null; onClose: () => void; onSaved: (next: StorePayments) => void }) {
  return (
    <Dialog open={gateway !== null} onOpenChange={(o) => !o && onClose()}>
      {gateway ? <ConnectForm gateway={gateway} onClose={onClose} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

/** The gateway's own fields (labels and where to find each one come from the server). Keys are never shown back. */
function ConnectForm({ gateway, onClose, onSaved }: { gateway: Gateway; onClose: () => void; onSaved: (next: StorePayments) => void }) {
  const [values, setValues] = React.useState<Record<string, string>>(() => Object.fromEntries(gateway.fields.map((f) => [f.key, ""])));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = Object.fromEntries(gateway.fields.filter((f) => values[f.key].trim() === "").map((f) => [f.key, ar.validation.required]));
    setErrors(missing);
    setFormError(null);
    if (Object.keys(missing).length > 0) return;
    setBusy(true);
    try {
      const next = await api<StorePayments>(`/dashboard/payments/gateways/${gateway.key}`, { method: "PUT", body: { credentials: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])) } });
      toast.success(t.connected(gateway.label));
      onSaved(next);
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        const fieldErrors = Object.fromEntries(Object.entries(error.errors).filter(([k]) => k.startsWith("credentials.")).map(([k, v]) => [k.slice("credentials.".length), v[0] ?? ""]));
        setErrors(fieldErrors);
        setFormError(error.errors.credentials?.[0] ?? (Object.keys(fieldErrors).length ? null : errorMessage(error)));
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent size="md">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <DialogHeader title={t.connectTitle(gateway.label)} description={t.connectHint} />
        <DialogBody className="flex flex-col gap-4">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          {gateway.connected ? <Alert tone="info">{t.replace}</Alert> : null}
          {gateway.fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`gw-${f.key}`} hint={f.hint} error={errors[f.key]} required>
              <Input
                id={`gw-${f.key}`}
                dir="ltr"
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errors[f.key])}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button type="submit" loading={busy}>
            {t.save}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
