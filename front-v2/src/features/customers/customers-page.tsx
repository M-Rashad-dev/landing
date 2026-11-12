"use client";

import { Ban, Users } from "lucide-react";
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
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { CUSTOMER_SORTS, SEGMENTS, useCustomers, type CustomerFilters, type CustomerRow, type CustomerSort, type Segment } from "./api";

const t = ar.orders.customers;

export function CustomersPage() {
  const router = useRouter();
  const [url, setUrl] = useUrlState(["q", "segment", "sort", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const filters: CustomerFilters = {
    q: url.q,
    segment: (SEGMENTS as readonly string[]).includes(url.segment) ? (url.segment as Segment) : "all",
    sort: (CUSTOMER_SORTS as readonly string[]).includes(url.sort) ? (url.sort as CustomerSort) : "latest",
    page: Math.max(1, Number(url.page) || 1),
  };
  const query = useCustomers(filters);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const columns: Column<CustomerRow>[] = [
    {
      key: "customer",
      header: t.columns.customer,
      cell: (c) => (
        <EntityCell
          avatar={c.name ?? c.phone}
          title={
            <span className="flex items-center gap-2">
              {c.name ?? formatPhone(c.phone)}
              {c.blocked ? (
                <Badge tone="danger" size="sm">
                  <Ban />
                  {t.blocked}
                </Badge>
              ) : null}
            </span>
          }
          subtitle={
            <span dir="ltr" className="tabular">
              {formatPhone(c.phone)}
            </span>
          }
        />
      ),
    },
    {
      key: "orders",
      header: t.columns.orders,
      cell: (c) => (
        <span className="flex flex-col">
          <span>{t.ordersCount(c.orders_count)}</span>
          <span className="flex gap-2 text-xs">
            {c.open_count ? <span className="text-info">{t.open(c.open_count)}</span> : null}
            {c.bad_count ? <span className="text-danger">{t.bad(c.bad_count)}</span> : null}
          </span>
        </span>
      ),
    },
    {
      key: "spent",
      header: t.columns.spent,
      align: "end",
      cell: (c) => <span className="font-semibold tabular">{formatMoney(c.spent)}</span>,
    },
    {
      key: "last",
      header: t.columns.last,
      hideOnMobile: true,
      cell: (c) => <span className="text-xs text-ink-3 tabular">{formatDateTime(c.last_order_at)}</span>,
    },
  ];

  const counts = query.data?.meta.counts;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        tabs={
          <Tabs value={filters.segment} onValueChange={(v) => setUrl({ segment: v === "all" ? null : v, page: null })}>
            <TabsList>
              {SEGMENTS.map((s) => (
                <TabsTrigger key={s} value={s} count={counts?.[s]}>
                  {t.segments[s]}
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
        actions={
          <Select
            aria-label={ar.orders.filters.sort}
            value={filters.sort}
            onValueChange={(v) => setUrl({ sort: v === "latest" ? null : v, page: null })}
            options={CUSTOMER_SORTS.map((s) => ({
              value: s,
              label: t.sort[s],
            }))}
            searchable={false}
            className="w-44"
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
            rowKey={(c) => c.id}
            loading={query.isPending}
            onRowClick={(c) => router.push(`/dashboard/customers/${c.id}`)}
            empty={
              <EmptyState
                icon={Users}
                title={filters.q || filters.segment !== "all" ? t.noResults : t.emptyTitle}
                description={filters.q || filters.segment !== "all" ? ar.orders.noResultsText : t.emptyText}
              />
            }
          />
          {query.data && query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
          ) : null}
        </>
      )}
    </>
  );
}
