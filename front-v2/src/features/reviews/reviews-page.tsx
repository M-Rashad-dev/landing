"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Star } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/data/data-table";
import { EntityCell } from "@/components/data/details";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, toast } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { REVIEW_TABS, setReviewHidden, useReviews, type ReviewFilters, type ReviewRow, type ReviewTab } from "./api";

const t = ar.reviews;

function StarsRow({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={t.stars(value)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= value ? "fill-accent text-accent" : "text-line")} aria-hidden />
      ))}
    </span>
  );
}

export function ReviewsPage() {
  const client = useQueryClient();
  const [url, setUrl] = useUrlState(["tab", "rating", "q", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const [busy, setBusy] = React.useState<number | null>(null);
  const filters: ReviewFilters = {
    tab: (REVIEW_TABS as readonly string[]).includes(url.tab) ? (url.tab as ReviewTab) : "all",
    rating: /^[1-5]$/.test(url.rating) ? Number(url.rating) : null,
    q: url.q,
    page: Math.max(1, Number(url.page) || 1),
  };
  const query = useReviews(filters);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const toggle = async (r: ReviewRow) => {
    setBusy(r.id);
    try {
      await setReviewHidden(r.id, !r.is_hidden);
      toast.success(r.is_hidden ? t.shownToast : t.hiddenToast);
      await client.invalidateQueries({ queryKey: ["reviews"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<ReviewRow>[] = [
    {
      key: "product",
      header: t.columns.product,
      cell: (r) => (
        <EntityCell
          image={r.product?.image?.thumb ?? null}
          title={r.product ? (r.product.deleted ? <span className="text-ink-3">{r.product.name}</span> : <Link href={`/dashboard/catalog/products/${r.product.id}`} className="hover:underline">{r.product.name}</Link>) : "—"}
          subtitle={r.product?.deleted ? t.deletedProduct : undefined}
        />
      ),
    },
    {
      key: "review",
      header: t.columns.review,
      cell: (r) => (
        <span className="flex max-w-md flex-col gap-1">
          <span className="flex items-center gap-2">
            <StarsRow value={r.rating} />
            {r.is_hidden ? (
              <Badge tone="neutral" size="sm">
                <EyeOff />
                {t.hidden}
              </Badge>
            ) : null}
          </span>
          <span className={cn("text-sm", r.text ? "text-ink" : "text-ink-3", r.is_hidden && "opacity-60")}>{r.text ?? t.noText}</span>
        </span>
      ),
    },
    {
      key: "customer",
      header: t.columns.customer,
      hideOnMobile: true,
      cell: (r) =>
        r.customer ? (
          <Link href={`/dashboard/customers/${r.customer.id}`} className="flex flex-col hover:underline">
            <span>{r.customer.name ?? r.author_name}</span>
            <span dir="ltr" className="text-xs text-ink-3 tabular">
              {formatPhone(r.customer.phone)}
            </span>
          </Link>
        ) : (
          r.author_name
        ),
    },
    {
      key: "date",
      header: t.columns.date,
      hideOnMobile: true,
      cell: (r) => <span className="text-xs text-ink-3 tabular">{formatDateTime(r.created_at)}</span>,
    },
    {
      key: "action",
      header: "",
      align: "end",
      cell: (r) => (
        <Button variant="outline" size="sm" onClick={() => void toggle(r)} disabled={busy === r.id}>
          {r.is_hidden ? <Eye /> : <EyeOff />}
          {r.is_hidden ? t.show : t.hide}
        </Button>
      ),
    },
  ];

  const counts = query.data?.meta.counts;
  const filtered = Boolean(filters.q || filters.rating || filters.tab !== "all");

  return (
    <>
      <PageHeader
        title={t.title}
        description={counts && counts.visible > 0 ? `${t.description} ${t.average(counts.average)}` : t.description}
        tabs={
          <Tabs value={filters.tab} onValueChange={(v) => setUrl({ tab: v === "all" ? null : v, page: null })}>
            <TabsList>
              {REVIEW_TABS.map((s) => (
                <TabsTrigger key={s} value={s} count={counts?.[s]}>
                  {t.tabs[s]}
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
            aria-label={t.rating}
            value={filters.rating ? String(filters.rating) : "all"}
            onValueChange={(v) => setUrl({ rating: v === "all" ? null : v, page: null })}
            options={[{ value: "all", label: t.allRatings }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: t.stars(n) }))]}
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
            rowKey={(r) => r.id}
            loading={query.isPending}
            empty={<EmptyState icon={Star} title={filtered ? t.noResults : t.emptyTitle} description={filtered ? ar.orders.noResultsText : t.emptyText} />}
          />
          {query.data && query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
          ) : null}
        </>
      )}
    </>
  );
}
