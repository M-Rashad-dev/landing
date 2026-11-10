"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Ban, Copy, Download, Filter, Printer, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable, Pagination, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatNumber } from "@/lib/format/number";
import { formatPhoneLocal } from "@/lib/format/phone";
import { useDebounced } from "@/lib/hooks/use-debounced";
import {
  bulkOrderStatus,
  downloadOrdersCsv,
  EMPTY_FILTERS,
  ORDER_STATUSES,
  orderKeys,
  useOrderCounts,
  useOrders,
  type OrderFilters,
  type OrderRow,
  type OrderStatus,
  orderProductLabel,
} from "@/lib/orders/api";
import { usePages } from "@/lib/pages/api";
import { formatPrice } from "@/lib/price";
import { useProducts } from "@/lib/products/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.orders;

export function OrdersManager({ initialStatus = "", initialPageId = "" }: { initialStatus?: string; initialPageId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<OrderFilters>({ ...EMPTY_FILTERS, page_id: initialPageId, status: (ORDER_STATUSES as readonly string[]).includes(initialStatus) ? initialStatus : "" });
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(initialPageId !== "");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const q = useDebounced(search, 350);
  const effective = useMemo(() => ({ ...filters, q }), [filters, q]);
  const { data, isPending, isFetching, isError, error, refetch } = useOrders(effective);
  const counts = useOrderCounts(effective).data;
  const pages = usePages({ page: 1 }).data?.data ?? [];
  const products = useProducts({ page: 1, per_page: 100 }).data?.data ?? [];
  const rows = data?.data;

  const filtering = q !== "" || filters.page_id !== "" || filters.product_id !== "" || filters.from !== "" || filters.to !== "" || filters.duplicate;
  const update = (patch: Partial<OrderFilters>) => {
    setFilters((current) => ({ ...current, page: 1, ...patch }));
    setSelected(new Set());
  };

  const allOnPage = rows?.length ? rows.every((r) => selected.has(r.id)) : false;
  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(rows?.map((r) => r.id)));

  async function applyBulk() {
    if (!bulkStatus || selected.size === 0) return;
    setBusy(true);
    try {
      const result = await bulkOrderStatus([...selected], bulkStatus as OrderStatus);
      const message = t.bulkResult(result.succeeded, result.failed);
      if (result.failed > 0) {
        const first = result.results.find((r) => !r.ok);
        toast.warning(message, { description: first?.error ?? undefined });
      } else {
        toast.success(message);
      }
      setSelected(new Set());
      setBulkStatus("");
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadOrdersCsv(effective);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const tabs: Array<{ value: string; label: string; count: number | undefined }> = [
    { value: "", label: t.all, count: counts?.all },
    ...ORDER_STATUSES.map((status) => ({ value: status, label: t.statuses[status], count: counts?.counts[status] })),
  ];

  const columns: Column<OrderRow>[] = [
    {
      key: "select",
      header: <Checkbox checked={allOnPage} onCheckedChange={toggleAll} aria-label={t.selected(rows?.length ?? 0)} />,
      className: "w-10",
      cell: (o) => <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} onClick={(e) => e.stopPropagation()} aria-label={t.orderTitle(o.order_number)} />,
    },
    {
      key: "number",
      header: t.columns.number,
      cell: (o) => (
        <Link href={`/dashboard/orders/${o.id}`} className="font-bold tabular-nums hover:underline" onClick={(e) => e.stopPropagation()}>
          #{o.order_number}
        </Link>
      ),
    },
    { key: "date", header: t.columns.date, cell: (o) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatCairo(o.created_at)}</span> },
    {
      key: "customer",
      header: t.columns.customer,
      cell: (o) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{o.customer_name}</span>
          {o.is_duplicate_suspect ? <DuplicateBadge /> : null}
        </span>
      ),
    },
    { key: "phone", header: t.columns.phone, cell: (o) => <span dir="ltr" className="whitespace-nowrap tabular-nums">{formatPhoneLocal(o.customer_phone)}</span> },
    { key: "product", header: t.columns.product, cell: (o) => (
        <span className="text-sm">
          {orderProductLabel(o, t.moreItems)}
          {o.source !== "store" && o.quantity > 1 ? <span className="text-muted-foreground"> × {o.quantity}</span> : null}
          {o.source === "store" ? <Badge variant="info" className="ms-2">{t.sourceStore}</Badge> : null}
        </span>
      ) },
    { key: "total", header: t.columns.total, cell: (o) => <span className="whitespace-nowrap font-semibold">{formatPrice(o.total)}</span> },
    { key: "status", header: t.columns.status, cell: (o) => <OrderStatusBadge status={o.status} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" aria-label={t.columns.status} className="flex w-max gap-1 rounded-xl border bg-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              role="tab"
              aria-selected={filters.status === tab.value}
              onClick={() => update({ status: tab.value })}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                filters.status === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {tab.label}
              {tab.count !== undefined ? <span className={cn("rounded-full px-1.5 text-xs tabular-nums", filters.status === tab.value ? "bg-primary-foreground/20" : "bg-muted")}>{formatNumber(tab.count)}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFilters((c) => ({ ...c, page: 1 }));
            }}
            placeholder={t.search}
            aria-label={t.search}
            className="ps-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={showFilters || filtering ? "secondary" : "outline"} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <Filter />
            {t.filters}
          </Button>
          <Select
            aria-label={ar.common.sort}
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value })}
            options={Object.entries(t.sort).map(([value, label]) => ({ value, label }))}
            className="w-36"
          />
          <Button variant="outline" onClick={exportCsv} loading={exporting}>
            <Download />
            {exporting ? t.exporting : t.export}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/orders/blocked">
              <Ban />
              {t.blocked}
            </Link>
          </Button>
        </div>
      </div>

      {showFilters ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select aria-label={t.allPages} value={filters.page_id} onChange={(e) => update({ page_id: e.target.value })} options={[{ value: "", label: t.allPages }, ...pages.map((p) => ({ value: String(p.id), label: p.title }))]} />
          <Select aria-label={t.allProducts} value={filters.product_id} onChange={(e) => update({ product_id: e.target.value })} options={[{ value: "", label: t.allProducts }, ...products.map((p) => ({ value: String(p.id), label: p.name }))]} />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t.from}
            <DatePicker value={filters.from} max={filters.to || undefined} onChange={(from) => update({ from })} aria-label={t.from} />
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t.to}
            <DatePicker value={filters.to} min={filters.from || undefined} onChange={(to) => update({ to })} aria-label={t.to} />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex h-10 items-center gap-2 text-sm">
              <Checkbox checked={filters.duplicate} onCheckedChange={(v) => update({ duplicate: v === true })} />
              {t.duplicateOnly}
            </label>
          </div>
          {filtering ? (
            <Button
              variant="link"
              className="justify-start px-0 sm:col-span-2 lg:col-span-5"
              onClick={() => {
                setSearch("");
                update({ ...EMPTY_FILTERS, status: filters.status, sort: filters.sort });
              }}
            >
              <X />
              {t.clearFilters}
            </Button>
          ) : null}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-semibold">{t.selected(selected.size)}</span>
          <Select
            aria-label={t.bulkChange}
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            placeholder={t.bulkChange}
            options={ORDER_STATUSES.map((s) => ({ value: s, label: t.statuses[s] }))}
            className="w-44"
          />
          <Button size="sm" onClick={applyBulk} disabled={!bulkStatus} loading={busy}>
            {ar.common.apply}
          </Button>
          <Button size="sm" variant="outline" asChild className="ms-auto">
            <a href={`/dashboard/orders/print?ids=${[...selected].join(",")}`} target="_blank" rel="noreferrer">
              <Printer />
              {t.printInvoices(selected.size)}
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {ar.common.cancel}
          </Button>
        </div>
      ) : null}

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && rows?.length === 0 && !filtering && filters.status === "" ? (
        <EmptyState icon={ShoppingBag} title={t.emptyTitle} description={t.emptyText} />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(o) => o.id}
              loading={isPending}
              onRowClick={(o) => router.push(`/dashboard/orders/${o.id}`)}
              empty={<p className="text-center text-sm text-muted-foreground">{t.noMatches}</p>}
              className={isFetching ? "opacity-80" : undefined}
            />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {rows?.map((order) => (
              <li key={order.id} className="flex gap-3 rounded-xl border bg-card p-3">
                <Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggle(order.id)} aria-label={t.orderTitle(order.order_number)} className="mt-1" />
                <Link href={`/dashboard/orders/${order.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold tabular-nums">#{order.order_number}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 flex items-center gap-2 truncate font-semibold">
                    {order.customer_name}
                    {order.is_duplicate_suspect ? <DuplicateBadge /> : null}
                  </p>
                  <p className="text-sm text-muted-foreground" dir="ltr">
                    {formatPhoneLocal(order.customer_phone)}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{orderProductLabel(order, t.moreItems)}</span>
                    <span className="font-semibold">{formatPrice(order.total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatCairo(order.created_at)}</p>
                </Link>
              </li>
            ))}
            {!isPending && rows?.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t.noMatches}</p> : null}
          </ul>
          <Pagination meta={data?.meta} onPageChange={(page) => setFilters((c) => ({ ...c, page }))} />
        </>
      )}
    </div>
  );
}

function DuplicateBadge() {
  return (
    <Badge variant="warning" title={t.duplicateHint} className="gap-1">
      <Copy className="size-3" aria-hidden />
      {t.duplicate}
    </Badge>
  );
}
