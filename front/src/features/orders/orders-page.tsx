"use client";

import { ArrowLeftRight, Copy, Download, ExternalLink, Phone, PhoneCall, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/data/data-table";
import { OrderSourceTag, OrderStatusBadge } from "@/components/domain/order-status";
import { DateRangePicker, type RangeValue } from "@/components/forms/date-pickers";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, toast } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuItem, Tooltip } from "@/components/ui/overlay";
import { useShipping } from "@/features/shipping/api";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import {
  exportOrders,
  NEXT,
  ORDER_SORTS,
  ORDER_TABS,
  TAB_STATUSES,
  useOrders,
  useOrderStats,
  useRefreshOrders,
  type OrderFilters,
  type OrderRow,
  type OrderSort,
  type OrderStatus,
  type OrderTab,
} from "./api";
import { useConfirmQueue } from "./confirm-queue";
import { OrderQuickView } from "./order-quick-view";
import { StatusDialog } from "./status-dialog";

const t = ar.orders;
const KEYS = ["tab", "q", "from", "to", "preset", "gov", "source", "company", "dup", "sort", "page"] as const;

export function OrdersPage() {
  const router = useRouter();
  const [url, setUrl] = useUrlState(KEYS);
  const [search, setSearch] = React.useState(url.q);
  const filters: OrderFilters = {
    tab: (ORDER_TABS as readonly string[]).includes(url.tab) ? (url.tab as OrderTab) : "all",
    q: url.q,
    from: url.from,
    to: url.to,
    governorate: url.gov,
    source: url.source,
    company: url.company,
    duplicate: url.dup === "1",
    sort: (ORDER_SORTS as readonly string[]).includes(url.sort) ? (url.sort as OrderSort) : "latest",
    page: Math.max(1, Number(url.page) || 1),
  };
  const query = useOrders(filters);
  const stats = useOrderStats(filters);
  const queue = useConfirmQueue();
  const shipping = useShipping();
  const refresh = useRefreshOrders();
  const [selected, setSelected] = React.useState<Array<string | number>>([]);
  const [quick, setQuick] = React.useState<OrderRow | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const rows = query.data?.data ?? [];
  const counts = stats.data?.counts;
  const tabCount = (tab: OrderTab) => (!stats.data ? undefined : tab === "all" ? stats.data.all : TAB_STATUSES[tab].reduce((sum, s) => sum + (counts?.[s] ?? 0), 0));
  const set = (patch: Partial<Record<(typeof KEYS)[number], string | null>>) => {
    setSelected([]);
    setUrl({ ...patch, page: null });
  };

  const selectedRows = rows.filter((r) => selected.includes(r.id));
  // Bulk targets: the statuses every selected order can move to.
  const bulkTargets = selectedRows.length === 0 ? [] : selectedRows.map((r) => NEXT[r.status]).reduce((a, b) => a.filter((s) => b.includes(s)));

  const range: RangeValue = {
    from: filters.from,
    to: filters.to,
    preset: (url.preset as RangeValue["preset"]) || (filters.from ? "custom" : "all"),
  };
  const governorates = shipping.data?.governorates ?? [];
  const companies = shipping.data?.companies ?? [];

  const chips = [
    ...(filters.governorate
      ? [
          {
            key: "gov",
            label: filters.governorate,
            onRemove: () => set({ gov: null }),
          },
        ]
      : []),
    ...(filters.source
      ? [
          {
            key: "source",
            label: ar.domain.source[filters.source as "store" | "landing"] ?? filters.source,
            onRemove: () => set({ source: null }),
          },
        ]
      : []),
    ...(filters.company
      ? [
          {
            key: "company",
            label: companies.find((c) => String(c.id) === filters.company)?.name ?? t.filters.company,
            onRemove: () => set({ company: null }),
          },
        ]
      : []),
    ...(filters.from
      ? [
          {
            key: "date",
            label: `${filters.from} ← ${filters.to}`,
            onRemove: () => set({ from: null, to: null, preset: null }),
          },
        ]
      : []),
    ...(filters.duplicate
      ? [
          {
            key: "dup",
            label: t.filters.duplicate,
            onRemove: () => set({ dup: null }),
          },
        ]
      : []),
  ];
  const filtered = Boolean(filters.q || chips.length);

  async function onExport() {
    setExporting(true);
    try {
      await exportOrders(filters);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<OrderRow>[] = [
    {
      key: "number",
      header: t.columns.number,
      cell: (o) => (
        <span className="flex flex-col">
          <span className="flex items-center gap-1.5 font-semibold tabular">
            #{o.order_number}
            {o.is_duplicate_suspect ? (
              <Tooltip content={t.duplicateHint}>
                <Badge tone="warning" size="sm">
                  <Copy />
                  {t.duplicate}
                </Badge>
              </Tooltip>
            ) : null}
          </span>
          <span className="text-xs text-ink-3 tabular">{formatDateTime(o.created_at)}</span>
        </span>
      ),
    },
    {
      key: "customer",
      header: t.columns.customer,
      cell: (o) => (
        <span className="flex flex-col">
          <span className="font-medium">{o.customer_name}</span>
          <span className="text-xs text-ink-3 tabular" dir="ltr">
            {formatPhone(o.customer_phone)}
          </span>
        </span>
      ),
    },
    {
      key: "items",
      header: t.columns.items,
      hideOnMobile: true,
      cell: (o) => (
        <span className="flex flex-col">
          <span className="line-clamp-1">{t.itemsSummary(o.items_summary?.first ?? o.product?.name ?? null, o.items_summary?.count ?? 1)}</span>
          <span className="mt-0.5">
            <OrderSourceTag source={o.source} page={o.page} />
          </span>
        </span>
      ),
    },
    {
      key: "place",
      header: t.columns.place,
      hideOnMobile: true,
      cell: (o) => (
        <span className="flex flex-col">
          <span>{o.governorate ?? "—"}</span>
          {o.shipping_company ? <span className="text-xs text-ink-3">{o.shipping_company}</span> : null}
        </span>
      ),
    },
    {
      key: "total",
      header: t.columns.total,
      align: "end",
      cell: (o) => <span className="font-semibold tabular">{formatMoney(o.total)}</span>,
    },
    {
      key: "status",
      header: t.columns.status,
      cell: (o) => <OrderStatusBadge status={o.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <Button asChild>
              <Link href="/dashboard/orders/confirm">
                <PhoneCall />
                {t.queue.open(queue.data?.meta.due ?? 0)}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void onExport()} loading={exporting}>
              <Download />
              {exporting ? t.exporting : t.export}
            </Button>
          </>
        }
        tabs={
          <Tabs value={filters.tab} onValueChange={(v) => set({ tab: v === "all" ? null : v })}>
            <TabsList>
              {ORDER_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} count={tabCount(tab)}>
                  {t.tabs[tab]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t.search}
        filters={
          <>
            <DateRangePicker
              value={range}
              onChange={(r) =>
                set({
                  from: r.from || null,
                  to: r.to || null,
                  preset: r.preset === "all" ? null : r.preset,
                })
              }
            />
            <Select
              aria-label={t.filters.governorate}
              value={filters.governorate}
              onValueChange={(v) => set({ gov: v || null })}
              options={governorates.map((g) => ({ value: g, label: g }))}
              emptyLabel={t.filters.allGovernorates}
              className="w-44"
            />
            <Select
              aria-label={t.filters.source}
              value={filters.source}
              onValueChange={(v) => set({ source: v || null })}
              options={[
                { value: "store", label: ar.domain.source.store },
                { value: "landing", label: ar.domain.source.landing },
              ]}
              emptyLabel={t.filters.allSources}
              searchable={false}
              className="w-36"
            />
            {companies.length > 0 ? (
              <Select
                aria-label={t.filters.company}
                value={filters.company}
                onValueChange={(v) => set({ company: v || null })}
                options={companies.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
                emptyLabel={t.filters.allCompanies}
                searchable={false}
                className="w-40"
              />
            ) : null}
            <Button variant={filters.duplicate ? "secondary" : "ghost"} size="sm" onClick={() => set({ dup: filters.duplicate ? null : "1" })} aria-pressed={filters.duplicate}>
              <Copy />
              {t.filters.duplicate}
            </Button>
          </>
        }
        actions={
          <Select
            aria-label={t.filters.sort}
            value={filters.sort}
            onValueChange={(v) => set({ sort: v === "latest" ? null : v })}
            options={ORDER_SORTS.map((s) => ({
              value: s,
              label: t.filters.sorts[s],
            }))}
            searchable={false}
            className="w-40"
          />
        }
        chips={chips}
        onClear={
          filtered
            ? () => {
                setSearch("");
                set({
                  q: null,
                  gov: null,
                  source: null,
                  company: null,
                  from: null,
                  to: null,
                  preset: null,
                  dup: null,
                });
              }
            : undefined
        }
      />

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.isPending ? undefined : rows}
            rowKey={(o) => o.id}
            loading={query.isPending}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            bulkActions={
              <Button size="sm" variant="outline" disabled={bulkTargets.length === 0} onClick={() => setBulkOpen(true)}>
                <ArrowLeftRight />
                {t.bulk.changeStatus}
              </Button>
            }
            onRowClick={setQuick}
            rowActions={(o) => (
              <>
                <MenuItem onSelect={() => router.push(`/dashboard/orders/${o.id}`)}>
                  <ExternalLink />
                  {t.open}
                </MenuItem>
                <MenuItem onSelect={() => window.location.assign(`tel:${o.customer_phone}`)}>
                  <Phone />
                  {t.call}
                </MenuItem>
              </>
            )}
            empty={
              filtered || filters.tab !== "all" ? (
                <EmptyState icon={ShoppingBag} title={t.noResults} description={t.noResultsText} />
              ) : (
                <EmptyState icon={ShoppingBag} title={t.emptyTitle} description={t.emptyText} />
              )
            }
          />
          {query.data && query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
          ) : null}
        </>
      )}

      <OrderQuickView row={quick} onClose={() => setQuick(null)} onOpen={(id) => router.push(`/dashboard/orders/${id}`)} />
      <StatusDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        targets={bulkTargets as OrderStatus[]}
        ids={selectedRows.map((r) => r.id)}
        onDone={async () => {
          setSelected([]);
          await refresh();
        }}
      />
    </>
  );
}
