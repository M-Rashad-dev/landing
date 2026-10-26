"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BadgePercent, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, Pagination, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { PROMOTION_STATUS_OPTIONS, PromotionStatusBadge } from "@/components/dashboard/promotion-status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { deleteOffer, offerKeys, toggleOffer, useOffers } from "@/lib/promotions/api";
import type { Offer } from "@/lib/types";
import { ar } from "@/messages/ar";
import { OfferFormDialog } from "./offer-form";

const t = ar.offers;

export function offerValueLabel(offer: Offer): string {
  if (offer.type === "percentage") return `${offer.value}%`;
  if (offer.type === "fixed") return `${formatPrice(offer.value)} ${t.perUnit}`;
  return t.bundleSummary(offer.bundle_quantity ?? 0, formatPrice(offer.bundle_price));
}

export function periodLabel(starts: string | null, ends: string | null): string {
  if (!starts && !ends) return ar.promotions.always;
  const from = starts ? `${ar.promotions.from} ${formatCairo(starts)}` : ar.promotions.noStart;
  const to = ends ? `${ar.promotions.to} ${formatCairo(ends)}` : ar.promotions.noEnd;
  return `${from} — ${to}`;
}

export function OffersManager() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useOffers({ status, page });
  const [editing, setEditing] = useState<Offer | null | "new">(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: offerKeys.all });

  async function onToggle(offer: Offer) {
    try {
      await toggleOffer(offer.id);
      toast.success(ar.promotions.toggled);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteOffer(deleting.id);
      toast.success(ar.promotions.deleted);
      setDeleting(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Offer>[] = [
    {
      key: "name",
      header: t.columns.name,
      cell: (o) => (
        <button type="button" className="text-start font-semibold hover:underline" onClick={() => setEditing(o)}>
          {o.name}
          {o.badge_text ? <span className="block text-xs font-normal text-muted-foreground">{o.badge_text}</span> : null}
        </button>
      ),
    },
    { key: "type", header: t.columns.type, cell: (o) => t.types[o.type] },
    { key: "value", header: t.columns.value, cell: (o) => <span className="whitespace-nowrap">{offerValueLabel(o)}</span> },
    { key: "products", header: t.columns.products, cell: (o) => <span className="text-sm text-muted-foreground">{o.products?.map((p) => p.name).join("، ") || "—"}</span> },
    { key: "period", header: t.columns.period, cell: (o) => <span className="text-xs text-muted-foreground">{periodLabel(o.starts_at, o.ends_at)}</span> },
    {
      key: "status",
      header: t.columns.status,
      cell: (o) => (
        <div className="flex items-center gap-2">
          <Switch checked={o.is_active} onCheckedChange={() => onToggle(o)} aria-label={t.fields.active} />
          <PromotionStatusBadge status={o.status} />
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{ar.common.actions}</span>,
      className: "w-12",
      cell: (o) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={ar.common.actions}>
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setEditing(o)}>
              <Pencil />
              {ar.common.edit}
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => setDeleting(o)}>
              <Trash2 />
              {ar.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-52">
          <Select
            aria-label={t.columns.status}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={PROMOTION_STATUS_OPTIONS}
          />
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus />
          {t.new}
        </Button>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && data?.data.length === 0 && !status ? (
        <EmptyState icon={BadgePercent} title={t.emptyTitle} description={t.emptyText} action={<Button onClick={() => setEditing("new")}>{t.new}</Button>} />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable columns={columns} rows={data?.data} rowKey={(o) => o.id} loading={isPending} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {data?.data.map((offer) => (
              <li key={offer.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-start font-semibold" onClick={() => setEditing(offer)}>
                    {offer.name}
                  </button>
                  <PromotionStatusBadge status={offer.status} />
                </div>
                <p className="mt-1 text-sm">{offerValueLabel(offer)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{periodLabel(offer.starts_at, offer.ends_at)}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Switch checked={offer.is_active} onCheckedChange={() => onToggle(offer)} aria-label={t.fields.active} />
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(offer)}>
                    <Trash2 />
                    {ar.common.delete}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}

      <OfferFormDialog
        offer={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refresh();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={ar.promotions.deleteTitle}
        description={ar.promotions.deleteText}
        confirmLabel={ar.common.delete}
        destructive
        loading={busy}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
