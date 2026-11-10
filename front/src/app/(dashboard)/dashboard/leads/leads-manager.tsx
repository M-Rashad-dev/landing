"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, MessageCircle, Phone, RotateCcw, Trash2, UserRoundSearch, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, Pagination, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { useSession } from "@/components/dashboard/session-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatPhoneLocal } from "@/lib/format/phone";
import { deleteLead, leadKeys, updateLead, useLeads, type Lead, type LeadStatus } from "@/lib/leads/api";
import { leadRecoveryMessage, telLink, whatsappLink } from "@/lib/orders/whatsapp";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.leads;
const STATUSES: LeadStatus[] = ["open", "contacted", "converted", "dismissed"];

export function LeadsManager() {
  const queryClient = useQueryClient();
  const session = useSession();
  const [status, setStatus] = useState<LeadStatus>("open");
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useLeads({ status, page });
  const [busy, setBusy] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Lead | null>(null);
  const store = session.tenant?.name ?? "";
  const refresh = () => queryClient.invalidateQueries({ queryKey: leadKeys.all });

  async function mark(lead: Lead, next: Exclude<LeadStatus, "converted">, quiet = false) {
    setBusy(lead.id);
    try {
      await updateLead(lead.id, next);
      if (!quiet) toast.success(t.updated);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(removing.id);
    try {
      await deleteLead(removing.id);
      toast.success(t.removed);
      setRemoving(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const columns: Column<Lead>[] = [
    {
      key: "customer",
      header: t.customer,
      cell: (lead) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{lead.customer_name || t.noName}</span>
          <span dir="ltr" className="self-start text-sm tabular-nums text-muted-foreground">
            {formatPhoneLocal(lead.customer_phone)}
          </span>
        </div>
      ),
    },
    {
      key: "product",
      header: t.product,
      cell: (lead) => (
        <div className="flex flex-col gap-0.5 text-sm">
          {lead.source === "store" && lead.cart ? (
            <>
              <span>{lead.cart.items.map((i) => `${i.name} × ${i.quantity}`).join("، ") || "—"}</span>
              <span className="text-xs text-muted-foreground">
                {t.cartTotal(formatPrice(lead.cart.total))}
                {lead.governorate ? ` · ${lead.governorate}` : ""}
              </span>
            </>
          ) : (
            <>
              <span>{lead.product?.name ?? "—"}</span>
              <span className="text-xs text-muted-foreground">
                {t.quantity(lead.quantity)}
                {lead.governorate ? ` · ${lead.governorate}` : ""}
              </span>
            </>
          )}
        </div>
      ),
    },
    { key: "page", header: t.page, cell: (lead) => <span className="text-sm text-muted-foreground">{lead.page?.title ?? "—"}</span> },
    { key: "when", header: t.when, cell: (lead) => <span className="text-xs text-muted-foreground">{formatCairo(lead.last_seen_at ?? lead.created_at)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">{ar.common.actions}</span>,
      className: "w-px whitespace-nowrap",
      cell: (lead) => (
        <div className="flex items-center justify-end gap-1.5">
          {lead.status === "converted" ? (
            lead.order ? (
              <Link href={`/dashboard/orders/${lead.order.id}`}>
                <Badge variant="success">{t.order(lead.order.number)}</Badge>
              </Link>
            ) : null
          ) : (
            <>
              <Button size="sm" variant="outline" asChild>
                <a href={telLink(lead.customer_phone)} onClick={() => lead.status === "open" && void mark(lead, "contacted", true)}>
                  <Phone />
                  {t.call}
                </a>
              </Button>
              <Button size="sm" asChild>
                <a
                  href={whatsappLink(lead.customer_phone, leadRecoveryMessage(lead, store))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => lead.status === "open" && void mark(lead, "contacted", true)}
                >
                  <MessageCircle />
                  {t.whatsapp}
                </a>
              </Button>
              {lead.status === "open" ? (
                <>
                  <Button size="icon-sm" variant="ghost" aria-label={t.markContacted} title={t.markContacted} disabled={busy === lead.id} onClick={() => mark(lead, "contacted")}>
                    <Check />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t.dismiss} title={t.dismiss} disabled={busy === lead.id} onClick={() => mark(lead, "dismissed")}>
                    <X />
                  </Button>
                </>
              ) : (
                <Button size="icon-sm" variant="ghost" aria-label={t.reopen} title={t.reopen} disabled={busy === lead.id} onClick={() => mark(lead, "open")}>
                  <RotateCcw />
                </Button>
              )}
            </>
          )}
          <Button size="icon-sm" variant="ghost" aria-label={t.remove} title={t.remove} onClick={() => setRemoving(lead)}>
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as LeadStatus);
          setPage(1);
        }}
      >
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="gap-1.5">
              {t.tabs[s]}
              {data?.meta.counts ? <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{data.meta.counts[s]}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(lead) => lead.id}
            loading={isPending}
            empty={<EmptyState icon={UserRoundSearch} title={t.emptyTitle[status]} description={t.emptyText} className="border-0" />}
          />
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? t.removeConfirm(formatPhoneLocal(removing.customer_phone)) : ""}
        confirmLabel={t.remove}
        loading={busy === removing?.id}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
