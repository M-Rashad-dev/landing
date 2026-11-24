"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Landmark, Link2, MoreHorizontal, Pencil, Plus, Smartphone, Trash2, Wallet } from "lucide-react";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioCards, SwitchRow } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";

const t = ar.settings.payments;
const KEY = ["store-payments"] as const;

export type PaymentKind = "instapay" | "wallet" | "bank" | "link";
export type StorePaymentMethod = { id: number; kind: PaymentKind; name: string; account: string | null; link: string | null; instructions: string | null; is_active: boolean };
export type StorePayments = { cod_enabled: boolean; cancel_after_days: number; methods: StorePaymentMethod[] };

const ICONS = { instapay: Wallet, wallet: Smartphone, bank: Landmark, link: Link2 } as const;
const KINDS: PaymentKind[] = ["instapay", "wallet", "bank", "link"];

/** «الدفع»: cash on delivery, the store's own prepaid methods (InstaPay, wallets, bank, a payment link), unpaid orders. */
export function PaymentsPage() {
  const query = useQuery({ queryKey: KEY, queryFn: () => api<StorePayments>("/dashboard/payments") });
  if (query.isPending) return <Skeleton className="h-96 max-w-3xl rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  return <Payments state={query.data} />;
}

function Payments({ state }: { state: StorePayments }) {
  const client = useQueryClient();
  const [editing, setEditing] = React.useState<StorePaymentMethod | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<StorePaymentMethod | null>(null);
  const [busy, setBusy] = React.useState(false);
  const keep = (next: StorePayments) => client.setQueryData(KEY, next);

  const saveSettings = async (patch: Partial<Pick<StorePayments, "cod_enabled" | "cancel_after_days">>) => {
    try {
      keep(await api<StorePayments>("/dashboard/payments/settings", { method: "PUT", body: { cod_enabled: state.cod_enabled, cancel_after_days: state.cancel_after_days, ...patch } }));
      toast.success(t.saved);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const toggle = async (method: StorePaymentMethod) => {
    try {
      keep(await api<StorePayments>(`/dashboard/payments/methods/${method.id}`, { method: "PUT", body: { ...method, is_active: !method.is_active } }));
      toast.success(method.is_active ? t.turnedOff : t.turnedOn);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/dashboard/payments/methods/${deleting.id}`, { method: "DELETE" });
      keep({ ...state, methods: state.methods.filter((m) => m.id !== deleting.id) });
      setDeleting(null);
      toast.success(t.deleted);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const activeOnline = state.methods.some((m) => m.is_active);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-ink-2">{t.description}</p>

      <Panel>
        <PanelHeader title={<span className="flex items-center gap-2"><Banknote className="size-4 text-ink-3" aria-hidden />{t.cod}</span>} />
        <PanelBody className="flex flex-col gap-2">
          <SwitchRow title={t.codOn} description={activeOnline ? t.codHint : t.codAlways} checked={state.cod_enabled || !activeOnline} disabled={!activeOnline} onCheckedChange={(v) => void saveSettings({ cod_enabled: v })} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title={t.prepaid}
          description={t.prepaidHint}
          actions={
            state.methods.length < 10 ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus />
                {t.add}
              </Button>
            ) : undefined
          }
        />
        {state.methods.length === 0 ? (
          <PanelBody>
            <EmptyState compact icon={Wallet} title={t.emptyTitle} description={t.emptyText} action={<Button size="sm" variant="outline" onClick={() => setEditing("new")}><Plus />{t.add}</Button>} />
          </PanelBody>
        ) : (
          <ul className="divide-y divide-border">
            {state.methods.map((m) => {
              const Icon = ICONS[m.kind];
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {m.name}
                      {m.is_active ? null : <Badge size="sm">{t.off}</Badge>}
                    </span>
                    <span className="block truncate text-xs text-ink-3" dir="auto">
                      {t.kinds[m.kind]}
                      {m.account ? ` · ${m.account}` : m.link ? ` · ${m.link}` : ""}
                    </span>
                  </span>
                  <Menu>
                    <MenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={ar.common.actions}>
                        <MoreHorizontal />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setEditing(m)}>
                        <Pencil />
                        {ar.common.edit}
                      </MenuItem>
                      <MenuItem onSelect={() => void toggle(m)}>{m.is_active ? t.turnOff : t.turnOn}</MenuItem>
                      <MenuItem destructive onSelect={() => setDeleting(m)}>
                        <Trash2 />
                        {ar.common.delete}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title={t.unpaid} description={t.unpaidHint} />
        <PanelBody>
          <Field label={t.cancelAfter} htmlFor="cancel-days" className="max-w-xs">
            <Select id="cancel-days" value={String(state.cancel_after_days)} onValueChange={(v) => void saveSettings({ cancel_after_days: Number(v) })} options={[1, 2, 3, 5, 7, 14, 30].map((d) => ({ value: String(d), label: t.days(d) }))} />
          </Field>
        </PanelBody>
      </Panel>

      <MethodDialog method={editing} onClose={() => setEditing(null)} onSaved={(next) => (keep(next), setEditing(null))} />
      <ConfirmDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)} title={t.deleteTitle} description={t.deleteText} confirmLabel={ar.common.delete} destructive loading={busy} onConfirm={() => void remove()} />
    </div>
  );
}

const schema = z
  .object({
    kind: z.enum(["instapay", "wallet", "bank", "link"]),
    name: z.string().trim().min(1, ar.validation.required).max(60, ar.validation.max(60)),
    account: z.string().trim().max(120, ar.validation.max(120)),
    link: z.string().trim().max(500, ar.validation.max(500)),
    instructions: z.string().trim().max(500, ar.validation.max(500)),
  })
  .superRefine((d, ctx) => {
    // Only the fields this kind shows are checked (a value typed before switching kind never blocks saving).
    const usesLink = d.kind === "instapay" || d.kind === "link";
    if (usesLink && d.link && !/^https:\/\/\S+$/.test(d.link)) ctx.addIssue({ code: "custom", path: ["link"], message: t.linkHttps });
    if (d.kind === "link" && !d.link) ctx.addIssue({ code: "custom", path: ["link"], message: t.linkRequired });
    if (d.kind !== "link" && !d.account && !(d.kind === "instapay" && d.link)) ctx.addIssue({ code: "custom", path: ["account"], message: t.accountRequired });
  });
type Values = z.infer<typeof schema>;

function MethodDialog({ method, onClose, onSaved }: { method: StorePaymentMethod | "new" | null; onClose: () => void; onSaved: (next: StorePayments) => void }) {
  const editing = method !== null && method !== "new" ? method : null;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { kind: "instapay", name: "", account: "", link: "", instructions: "" } });
  const kind = useWatch({ control: form.control, name: "kind" });
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    if (method === null) return;
    form.reset(editing ? { kind: editing.kind, name: editing.name, account: editing.account ?? "", link: editing.link ?? "", instructions: editing.instructions ?? "" } : { kind: "instapay", name: t.kinds.instapay, account: "", link: "", instructions: "" });
  }, [method, editing, form]);

  const submit = form.handleSubmit(async (d) => {
    const body = { kind: d.kind, name: d.name, account: d.kind === "link" ? null : d.account || null, link: d.kind === "instapay" || d.kind === "link" ? d.link || null : null, instructions: d.instructions || null, is_active: editing?.is_active ?? true };
    try {
      onSaved(await api<StorePayments>(editing ? `/dashboard/payments/methods/${editing.id}` : "/dashboard/payments/methods", { method: editing ? "PUT" : "POST", body }));
      toast.success(t.saved);
    } catch (error) {
      if (isApiError(error)) for (const [key, messages] of Object.entries(error.errors)) form.setError(key as keyof Values, { message: messages[0] });
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={method !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader title={editing ? t.editTitle : t.addTitle} description={t.dialogHint} />
        <form onSubmit={(e) => void submit(e)} noValidate>
          <DialogBody className="flex flex-col gap-4">
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <RadioCards
                  name="kind"
                  value={field.value}
                  onValueChange={(v) => {
                    // A fresh method takes the kind's usual name.
                    if (!editing && (form.getValues("name") === "" || KINDS.some((k) => t.kinds[k] === form.getValues("name")))) form.setValue("name", t.kinds[v as PaymentKind]);
                    field.onChange(v);
                  }}
                  options={KINDS.map((k) => ({ value: k, title: t.kinds[k], description: t.kindHints[k] }))}
                />
              )}
            />
            <Field label={t.name} htmlFor="pm-name" error={errors.name?.message} required>
              <Input id="pm-name" placeholder={t.namePlaceholder[kind]} {...form.register("name")} />
            </Field>
            {kind !== "link" ? (
              <Field label={t.account[kind]} htmlFor="pm-account" error={errors.account?.message} required={kind !== "instapay"}>
                <Input id="pm-account" dir="ltr" placeholder={t.accountPlaceholder[kind]} {...form.register("account")} />
              </Field>
            ) : null}
            {kind === "instapay" || kind === "link" ? (
              <Field label={kind === "link" ? t.link : t.instapayLink} htmlFor="pm-link" hint={kind === "instapay" ? t.instapayLinkHint : t.linkHint} error={errors.link?.message} required={kind === "link"} optional={kind === "instapay"}>
                <Input id="pm-link" dir="ltr" placeholder="https://" {...form.register("link")} />
              </Field>
            ) : null}
            <Field label={t.instructions} htmlFor="pm-instructions" hint={t.instructionsHint} error={errors.instructions?.message} optional>
              <Textarea id="pm-instructions" rows={3} placeholder={t.instructionsPlaceholder} {...form.register("instructions")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {ar.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
