"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Plus } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { MoneyInput } from "@/components/forms/inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LockedNotice, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { usePlanFeature } from "@/lib/auth/session-context";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { useProductChoices } from "../api";
import { PromoRow } from "../shared";

const t = ar.growth.upsells;

export type Upsell = {
  id: number;
  name: string;
  trigger_product: { id: number; name: string } | null;
  offer_product: { id: number; name: string; price: number };
  price: number;
  headline: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  accepted_count: number;
  accepted_revenue: number;
};

const KEY = ["upsells"] as const;

/** «عروض ما بعد الطلب»: one product offered on the thank-you screen, added to the same order in one click. */
export function UpsellsPage() {
  const allowed = usePlanFeature("upsells");
  const client = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: () => api<Upsell[]>("/dashboard/upsells") });
  const [editing, setEditing] = React.useState<Upsell | "new" | null>(null);
  const [removing, setRemoving] = React.useState<Upsell | null>(null);
  const [busy, setBusy] = React.useState(false);
  const refresh = () => client.invalidateQueries({ queryKey: KEY });

  async function toggle(u: Upsell) {
    try {
      await api(`/dashboard/upsells/${u.id}/toggle`, { method: "POST" });
      toast.success(ar.promotions.toggled(!u.is_active));
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/dashboard/upsells/${removing.id}`, { method: "DELETE" });
      toast.success(t.removed);
      setRemoving(null);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const add = (
    <Button onClick={() => setEditing("new")} disabled={!allowed}>
      <Plus />
      {t.add}
    </Button>
  );

  return (
    <>
      <PageHeader title={t.title} description={t.description} actions={allowed ? add : undefined} />
      {!allowed ? <div className="mb-4"><LockedNotice title={t.locked} description={t.lockedText} /></div> : null}
      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : query.data.length === 0 ? (
        allowed ? <EmptyState icon={Gift} title={t.empty} description={t.emptyText} action={add} /> : null
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {query.data.map((u) => (
            <PromoRow
              key={u.id}
              icon={Gift}
              title={u.name}
              summary={`${u.offer_product.name} · ${formatMoney(u.price)} ${u.price < u.offer_product.price ? t.regular(u.offer_product.price) : ""}`.trim()}
              meta={[`${t.trigger}: ${u.trigger_product?.name ?? t.anyProduct}`, t.accepted(u.accepted_count), ...(u.accepted_revenue > 0 ? [t.revenue(u.accepted_revenue)] : [])]}
              status={u.is_active ? "active" : "inactive"}
              locked={!allowed}
              active={u.is_active}
              onToggle={() => void toggle(u)}
              onEdit={() => setEditing(u)}
              onDelete={() => setRemoving(u)}
            />
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => (o ? undefined : setEditing(null))}>
        <DialogContent size="md">{editing !== null ? <UpsellForm key={editing === "new" ? "new" : editing.id} upsell={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}</DialogContent>
      </Dialog>
      <ConfirmDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)} title={removing ? t.removeTitle(removing.name) : ""} confirmLabel={ar.common.delete} destructive loading={busy} onConfirm={() => void remove()} />
    </>
  );
}

const schema = z.object({
  name: z.string().trim().min(2, t.nameRequired).max(120),
  trigger_product_id: z.string(),
  offer_product_id: z.string().min(1, t.offerRequired),
  price: z.string().refine((v) => Number(v) >= 1, t.priceRequired),
  headline: z.string().trim().min(2, t.headlineRequired).max(150),
  description: z.string().max(300),
  priority: z.string().regex(/^\d{0,4}$/),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["name", "trigger_product_id", "offer_product_id", "price", "headline", "description", "priority"] as const;

function UpsellForm({ upsell, onClose }: { upsell: Upsell | null; onClose: () => void }) {
  const client = useQueryClient();
  const products = useProductChoices();
  const options = (products.data ?? []).map((p) => ({ value: String(p.id), label: p.name, hint: formatMoney(p.price) }));
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: upsell?.name ?? "",
      trigger_product_id: upsell?.trigger_product ? String(upsell.trigger_product.id) : "",
      offer_product_id: upsell ? String(upsell.offer_product.id) : "",
      price: upsell ? String(upsell.price) : "",
      headline: upsell?.headline ?? "",
      description: upsell?.description ?? "",
      priority: String(upsell?.priority ?? 0),
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    const body = { ...v, trigger_product_id: v.trigger_product_id ? Number(v.trigger_product_id) : null, offer_product_id: Number(v.offer_product_id), price: Number(v.price), priority: Number(v.priority || 0), description: v.description.trim() || null };
    try {
      if (upsell) await api(`/dashboard/upsells/${upsell.id}`, { method: "PUT", body: { ...body, is_active: upsell.is_active } });
      else await api("/dashboard/upsells", { method: "POST", body });
      toast.success(t.saved);
      await client.invalidateQueries({ queryKey: KEY });
      onClose();
    } catch (error) {
      if (isApiError(error)) for (const f of FIELDS) if (error.errors[f]?.[0]) form.setError(f, { message: error.errors[f][0] });
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <DialogHeader title={upsell ? upsell.name : t.add} />
      <form onSubmit={submit} noValidate>
        <DialogBody className="flex flex-col gap-4">
          <Field label={t.name} htmlFor="up-name" error={errors.name?.message} required>
            <Input id="up-name" {...form.register("name")} />
          </Field>
          <Field label={t.trigger} htmlFor="up-trigger" error={errors.trigger_product_id?.message}>
            <Controller control={form.control} name="trigger_product_id" render={({ field }) => <Select id="up-trigger" value={field.value} onValueChange={field.onChange} options={options} emptyLabel={t.anyProduct} />} />
          </Field>
          <Field label={t.offer} htmlFor="up-offer" error={errors.offer_product_id?.message} hint={t.optionsNote} required>
            <Controller
              control={form.control}
              name="offer_product_id"
              render={({ field }) => (
                <Select
                  id="up-offer"
                  value={field.value}
                  invalid={!!errors.offer_product_id}
                  placeholder={t.offer}
                  options={options}
                  onValueChange={(v) => {
                    field.onChange(v);
                    const product = products.data?.find((p) => String(p.id) === v);
                    if (product && !form.getValues("price")) form.setValue("price", String(product.price));
                  }}
                />
              )}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.price} htmlFor="up-price" error={errors.price?.message} required>
              <Controller control={form.control} name="price" render={({ field }) => <MoneyInput id="up-price" value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label={t.priority} htmlFor="up-priority" hint={t.priorityHint} error={errors.priority?.message}>
              <Input id="up-priority" dir="ltr" inputMode="numeric" className="tabular" {...form.register("priority")} />
            </Field>
          </div>
          <Field label={t.headline} htmlFor="up-headline" hint={t.headlineHint} error={errors.headline?.message} required>
            <Input id="up-headline" {...form.register("headline")} />
          </Field>
          <Field label={t.descriptionLabel} htmlFor="up-desc" error={errors.description?.message} optional>
            <Textarea id="up-desc" rows={2} {...form.register("description")} />
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
    </>
  );
}
