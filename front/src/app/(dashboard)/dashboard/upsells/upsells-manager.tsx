"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatPrice } from "@/lib/price";
import { useProducts } from "@/lib/products/api";
import { deleteUpsell, saveUpsell, toggleUpsell, upsellKeys, useUpsells, type Upsell } from "@/lib/upsells/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.upsells;

export function UpsellsManager() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useUpsells();
  const [editing, setEditing] = useState<Upsell | "new" | null>(null);
  const [removing, setRemoving] = useState<Upsell | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: upsellKeys.all });

  async function toggle(upsell: Upsell) {
    try {
      await toggleUpsell(upsell.id);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteUpsell(removing.id);
      toast.success(t.removed);
      setRemoving(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.length > 0 ? (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {t.create}
          </Button>
        </div>
      ) : null}

      {data.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={t.emptyTitle}
          description={t.emptyText}
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus />
              {t.create}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((upsell) => (
            <li key={upsell.id}>
              <Card className={cn("flex h-full flex-col gap-3 p-5 transition-opacity", !upsell.is_active && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold">{upsell.name}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {upsell.trigger_product ? t.after(upsell.trigger_product.name) : t.afterAny}
                      <ArrowLeft className="size-3" aria-hidden />
                      <span className="font-medium text-foreground">{upsell.offer_product.name}</span>
                    </p>
                  </div>
                  <Switch checked={upsell.is_active} onCheckedChange={() => void toggle(upsell)} aria-label={`${t.active} — ${upsell.name}`} />
                </div>
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">«{upsell.headline}»</p>
                <p className="text-sm">
                  <span className="font-display text-lg font-semibold">{formatPrice(upsell.price)}</span>{" "}
                  {upsell.offer_product.price > upsell.price ? <span className="text-muted-foreground line-through">{t.regular(formatPrice(upsell.offer_product.price))}</span> : null}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
                  <Badge variant={upsell.accepted_count > 0 ? "success" : "secondary"}>{t.accepted(upsell.accepted_count)}</Badge>
                  {upsell.accepted_revenue > 0 ? <Badge variant="gold">{t.revenue(formatPrice(upsell.accepted_revenue))}</Badge> : null}
                  <span className="ms-auto flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(upsell)} aria-label={t.edit}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setRemoving(upsell)} aria-label={ar.common.delete} className="text-destructive hover:text-destructive">
                      <Trash2 />
                    </Button>
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing ? <UpsellDialog upsell={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} /> : null}

      <ConfirmDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)} title={removing ? t.removeConfirm(removing.name) : ""} confirmLabel={ar.common.delete} destructive loading={busy} onConfirm={() => void remove()} />
    </div>
  );
}

function UpsellDialog({ upsell, onClose, onSaved }: { upsell: Upsell | null; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const products = useProducts({ per_page: 100 });
  const [form, setForm] = useState({
    name: upsell?.name ?? "",
    trigger: upsell?.trigger_product ? String(upsell.trigger_product.id) : "",
    offer: upsell ? String(upsell.offer_product.id) : "",
    price: upsell ? String(upsell.price) : "",
    headline: upsell?.headline ?? "",
    description: upsell?.description ?? "",
    priority: String(upsell?.priority ?? 0),
    active: upsell?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const options = (products.data?.data ?? []).map((p) => ({ value: String(p.id), label: p.name, hint: formatPrice(Number(p.price)) }));

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      await saveUpsell(
        {
          name: form.name,
          trigger_product_id: form.trigger ? Number(form.trigger) : null,
          offer_product_id: Number(form.offer),
          price: form.price,
          headline: form.headline,
          description: form.description.trim() || null,
          priority: Number(form.priority) || 0,
          is_active: form.active,
        },
        upsell?.id,
      );
      toast.success(t.saved);
      await onSaved();
      onClose();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0] ?? ""])));
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{upsell ? t.edit : t.create}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.trigger} htmlFor="up-trigger" error={errors.trigger_product_id}>
            <Select id="up-trigger" value={form.trigger} onChange={(e) => set({ trigger: e.target.value })} placeholder={t.anyProduct} options={options} />
          </FormField>
          <FormField label={t.offerProduct} htmlFor="up-offer" error={errors.offer_product_id} hint={errors.offer_product_id ? undefined : t.offerHint} required>
            <Select id="up-offer" value={form.offer} onChange={(e) => set({ offer: e.target.value })} placeholder={ar.common.choose} options={options} />
          </FormField>
          <FormField label={`${t.price} (${ar.common.currency})`} htmlFor="up-price" error={errors.price} required>
            <Input id="up-price" inputMode="decimal" dir="ltr" className="text-start" value={form.price} onChange={(e) => set({ price: e.target.value })} />
          </FormField>
          <FormField label={t.name} htmlFor="up-name" error={errors.name} required>
            <Input id="up-name" maxLength={120} value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          <FormField label={t.headline} htmlFor="up-headline" error={errors.headline} className="sm:col-span-2" required>
            <Input id="up-headline" maxLength={150} placeholder={t.headlinePlaceholder} value={form.headline} onChange={(e) => set({ headline: e.target.value })} />
          </FormField>
          <FormField label={t.descriptionLabel} htmlFor="up-desc" error={errors.description} className="sm:col-span-2" optional>
            <Textarea id="up-desc" rows={2} maxLength={300} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </FormField>
          <FormField label={t.priority} htmlFor="up-priority" hint={t.priorityHint} error={errors.priority}>
            <Input id="up-priority" inputMode="numeric" dir="ltr" className="text-start" value={form.priority} onChange={(e) => set({ priority: e.target.value })} />
          </FormField>
          <label className="flex items-center justify-between gap-3 self-end rounded-lg border px-3 py-2.5">
            <span className="text-sm font-medium">{t.active}</span>
            <Switch checked={form.active} onCheckedChange={(active) => set({ active })} aria-label={t.active} />
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {ar.common.cancel}
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!form.offer || !form.price || !form.headline.trim() || !form.name.trim()}>
            {ar.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
