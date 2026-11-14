"use client";

import { Store } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/data/data-table";
import { EntityCell } from "@/components/data/details";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney, formatNumber, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { STORE_SORTS, STORE_STATUSES, STORE_TABS, useAdminPlans, useStores, type StoreFilters, type StoreRow, type StoreSort, type StoreStatus, type StoreTab } from "./api";

const t = ar.admin.stores;

export function StoresPage() {
  const router = useRouter();
  const [url, setUrl] = useUrlState(["q", "tab", "status", "plan", "sort", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const plans = useAdminPlans();
  const filters: StoreFilters = {
    q: url.q,
    tab: (STORE_TABS as readonly string[]).includes(url.tab) ? (url.tab as StoreTab) : "all",
    status: (STORE_STATUSES as readonly string[]).includes(url.status) ? (url.status as StoreStatus) : "all",
    plan: url.plan,
    sort: (STORE_SORTS as readonly string[]).includes(url.sort) ? (url.sort as StoreSort) : "newest",
    page: Math.max(1, Number(url.page) || 1),
  };
  const query = useStores(filters);
  const filtered = Boolean(filters.q || filters.tab !== "all" || filters.status !== "all" || filters.plan);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const columns: Column<StoreRow>[] = [
    {
      key: "store",
      header: t.columns.store,
      cell: (s) => (
        <EntityCell
          avatar={s.name}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {s.name}
              {s.status === "suspended" ? (
                <Badge tone="danger" size="sm">
                  {t.status.suspended}
                </Badge>
              ) : null}
            </span>
          }
          subtitle={
            s.primary_host ? (
              <span dir="ltr" className="tabular">
                {s.primary_host}
              </span>
            ) : undefined
          }
        />
      ),
    },
    {
      key: "owner",
      header: t.columns.owner,
      hideOnMobile: true,
      cell: (s) =>
        s.owner ? (
          <span className="flex flex-col">
            <span>{s.owner.name}</span>
            <span dir="ltr" className="tabular text-start text-xs text-ink-3">
              {formatPhone(s.owner.phone)}
            </span>
          </span>
        ) : null,
    },
    {
      key: "plan",
      header: t.columns.plan,
      cell: (s) => <PlanCell store={s} />,
    },
    { key: "orders", header: t.columns.orders, align: "end", hideOnMobile: true, cell: (s) => <span className="tabular">{formatNumber(s.orders_count)}</span> },
    { key: "sales", header: t.columns.sales, align: "end", cell: (s) => <span className="tabular font-semibold">{formatMoney(s.sales)}</span> },
    {
      key: "login",
      header: t.columns.lastLogin,
      hideOnMobile: true,
      cell: (s) => <span className="tabular text-xs text-ink-3">{s.owner?.last_login_at ? formatDateTime(s.owner.last_login_at) : t.never}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        tabs={
          <Tabs value={filters.tab} onValueChange={(v) => setUrl({ tab: v === "all" ? null : v, page: null })}>
            <TabsList>
              {STORE_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
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
            <Select
              aria-label={t.statusLabel}
              value={filters.status}
              onValueChange={(v) => setUrl({ status: v === "all" ? null : v, page: null })}
              options={STORE_STATUSES.map((s) => ({ value: s, label: t.status[s] }))}
              searchable={false}
              className="w-36"
            />
            <Select
              aria-label={t.planLabel}
              value={filters.plan || "all"}
              onValueChange={(v) => setUrl({ plan: v === "all" ? null : v, page: null })}
              options={[{ value: "all", label: t.allPlans }, ...(plans.data ?? []).map((p) => ({ value: p.key, label: p.name }))]}
              searchable={false}
              className="w-40"
            />
          </>
        }
        actions={
          <Select
            aria-label={t.sortLabel}
            value={filters.sort}
            onValueChange={(v) => setUrl({ sort: v === "newest" ? null : v, page: null })}
            options={STORE_SORTS.map((s) => ({ value: s, label: t.sort[s] }))}
            searchable={false}
            className="w-40"
          />
        }
      />
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.isPending ? undefined : query.data.data}
            rowKey={(s) => s.id}
            loading={query.isPending}
            onRowClick={(s) => router.push(`/admin/stores/${s.id}`)}
            empty={<EmptyState icon={Store} title={filtered ? t.noResults : t.emptyTitle} description={filtered ? t.noResultsText : t.emptyText} />}
          />
          {query.data && query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
          ) : null}
        </>
      )}
    </>
  );
}

const STATE_TONE = { active: "success", grace: "warning", expired: "neutral" } as const;

export function PlanCell({ store }: { store: Pick<StoreRow, "plan_name" | "plan_state" | "plan_is_trial" | "plan_ends_at"> }) {
  if (!store.plan_name) return <span className="text-xs text-ink-3">{t.noPlan}</span>;
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className="flex items-center gap-1.5">
        <Badge tone={STATE_TONE[store.plan_state]} size="sm" dot>
          {store.plan_name}
        </Badge>
        {store.plan_is_trial ? (
          <Badge tone="info" size="sm">
            {t.trial}
          </Badge>
        ) : null}
      </span>
      {store.plan_ends_at ? <span className="tabular text-[11px] text-ink-3">{t.endsAt(formatDateTime(store.plan_ends_at).slice(0, 10))}</span> : null}
    </span>
  );
}
