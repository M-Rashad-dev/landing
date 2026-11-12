"use client";

import { Copy, History, Plus, TicketPercent } from "lucide-react";
import * as React from "react";
import { Meter } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { usePlanLimit } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { deletePromo, STATUS_FILTERS, togglePromo, useCoupons, useRedemptions, useRefresh, type Coupon, type StatusFilter } from "../api";
import { ListToolbar, periodText, PromoList, PromoRow, targetText, useDebouncedSearch } from "../shared";
import { CouponDrawer, couponSummary, type CouponDrawerState } from "./coupon-drawer";

const t = ar.promotions.coupons;

export function CouponsPage() {
  const [url, setUrl] = useUrlState(["q", "status", "page"] as const);
  const commitSearch = React.useCallback((q: string | null) => setUrl({ q, page: null }), [setUrl]);
  const [search, setSearch] = useDebouncedSearch(url.q, commitSearch);
  const filters = {
    q: url.q,
    status: ((STATUS_FILTERS as readonly string[]).includes(url.status) ? url.status : "all") as StatusFilter,
    page: Math.max(1, Number(url.page) || 1),
  };
  const query = useCoupons(filters);
  const refresh = useRefresh("coupons");
  const limit = usePlanLimit("discount_codes");
  const [drawer, setDrawer] = React.useState<CouponDrawerState>(null);
  const [deleting, setDeleting] = React.useState<Coupon | null>(null);
  const [history, setHistory] = React.useState<Coupon | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function toggle(c: Coupon) {
    try {
      const updated = await togglePromo("coupons", c.id);
      toast.success(ar.promotions.toggled(updated.is_active));
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePromo("coupons", deleting.id);
      toast.success(t.deleted);
      setDeleting(null);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t.codeCopied);
    } catch {
      toast.error(ar.errors.generic);
    }
  }

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setDrawer({ mode: "create" })}>
            <Plus />
            {t.add}
          </Button>
        }
      />

      {limit !== null && query.data ? (
        <div className="mb-4 max-w-xs">
          <Meter used={query.data.meta.total} limit={limit} label={t.title} />
        </div>
      ) : null}

      <ListToolbar search={search} onSearch={setSearch} status={filters.status} onStatus={(v) => setUrl({ status: v === "all" ? null : v, page: null })} placeholder={t.search} />

      <PromoList
        query={query}
        filtered={Boolean(filters.q || filters.status !== "all")}
        empty={{ icon: TicketPercent, title: t.emptyTitle, text: t.emptyText, action: <Button onClick={() => setDrawer({ mode: "create" })}><Plus />{t.add}</Button> }}
        onClearFilters={() => {
          setSearch("");
          setUrl({ q: null, status: null, page: null });
        }}
        onPage={(page) => setUrl({ page: String(page) })}
      >
        {(items) =>
          items.map((c) => (
            <PromoRow
              key={c.id}
              icon={TicketPercent}
              title={<span dir="ltr">{c.code}</span>}
              titleClassName="font-mono font-bold tracking-wider"
              summary={couponSummary({ type: c.type, value: String(c.value ?? ""), max_discount: String(c.max_discount ?? ""), min_order_total: String(c.min_order_total ?? ""), min_quantity: String(c.min_quantity ?? ""), first_order_only: c.first_order_only })}
              meta={[t.used(c.used_count, c.usage_limit), targetText(c), periodText(c)]}
              status={c.status}
              locked={c.locked_by_plan}
              active={c.is_active}
              onToggle={() => void toggle(c)}
              onEdit={() => setDrawer({ mode: "edit", coupon: c })}
              onDelete={() => setDeleting(c)}
              extra={[
                { label: t.copyCode, icon: Copy, onSelect: () => void copy(c.code) },
                { label: t.redemptions, icon: History, onSelect: () => setHistory(c) },
              ]}
            />
          ))
        }
      </PromoList>

      <CouponDrawer state={drawer} onClose={() => setDrawer(null)} />
      <ConfirmDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)} title={deleting ? t.deleteTitle(deleting.code) : ""} description={t.deleteText} confirmLabel={ar.common.delete} destructive loading={busy} onConfirm={() => void confirmDelete()} />
      <RedemptionsDialog coupon={history} onClose={() => setHistory(null)} />
    </>
  );
}

function RedemptionsDialog({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const query = useRedemptions(coupon?.id ?? null);
  const rows = query.data?.data ?? [];
  return (
    <Dialog open={coupon !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader title={coupon ? t.redemptionsTitle(coupon.code) : ""} description={coupon ? t.used(coupon.used_count, coupon.usage_limit) : undefined} />
        <DialogBody>
          {query.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
          ) : rows.length === 0 ? (
            <EmptyState compact icon={History} title={t.redemptionsEmpty} />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-3">
                <tr>
                  <th className="pb-2 text-start font-medium">{t.phone}</th>
                  <th className="pb-2 text-start font-medium">{t.saved_amount}</th>
                  <th className="pb-2 text-start font-medium">{t.date}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 tabular" dir="ltr">
                      {formatPhone(r.phone)}
                    </td>
                    <td className="py-2 tabular">
                      {formatMoney(r.amount)}
                      {r.released_at ? (
                        <Badge size="sm" className="ms-2">
                          {t.released}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2 tabular text-ink-2">{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>{ar.common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
