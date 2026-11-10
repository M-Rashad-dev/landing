"use client";

import { Building2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DataTable, Pagination, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminTenants, type AdminTenant } from "@/lib/admin/api";
import { formatCairo } from "@/lib/dates";
import { formatNumber } from "@/lib/format/number";
import { formatPhoneLocal } from "@/lib/format/phone";
import { ar } from "@/messages/ar";

const t = ar.admin.tenants;

function TenantPlanBadge({ row }: { row: AdminTenant }) {
  if (!row.plan_key) return <Badge variant="secondary">{t.noPlan}</Badge>;
  const variant = row.plan_state === "active" ? (row.plan_is_trial ? "info" : "success") : row.plan_state === "grace" ? "warning" : "destructive";
  return (
    <Badge variant={variant} title={row.plan_ends_at ? t.planEnds(formatCairo(row.plan_ends_at, { withTime: false })) : undefined}>
      <span dir="ltr">{row.plan_key}</span> · {ar.billing.state[row.plan_state]}
    </Badge>
  );
}

export function TenantStatusBadge({ status }: { status: AdminTenant["status"] }) {
  return <Badge variant={status === "active" ? "success" : "destructive"}>{t.statuses[status]}</Badge>;
}

export function TenantsManager({ initialStatus }: { initialStatus: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useAdminTenants(q, status, page);

  // Debounced search.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const columns: Column<AdminTenant>[] = [
    {
      key: "store",
      header: t.store,
      cell: (row) => (
        <Link href={`/admin/tenants/${row.id}`} className="font-semibold hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "owner", header: t.owner, cell: (row) => <span className="text-sm">{row.owner?.name ?? "—"}</span> },
    {
      key: "phone",
      header: t.phone,
      cell: (row) => (
        <span dir="ltr" className="text-sm tabular-nums">
          {row.owner ? formatPhoneLocal(row.owner.phone) : "—"}
        </span>
      ),
    },
    {
      key: "subdomain",
      header: t.subdomain,
      cell: (row) => (
        <span dir="ltr" className="text-xs text-muted-foreground">
          {row.subdomain ?? "—"}
        </span>
      ),
    },
    { key: "pages", header: t.pages, cell: (row) => <span className="tabular-nums">{formatNumber(row.pages_count)}</span> },
    { key: "orders", header: t.orders, cell: (row) => <span className="tabular-nums">{formatNumber(row.orders_count)}</span> },
    { key: "registered", header: t.registered, cell: (row) => <span className="text-xs text-muted-foreground">{formatCairo(row.created_at, { withTime: false })}</span> },
    { key: "status", header: t.status, cell: (row) => <TenantStatusBadge status={row.status} /> },
    { key: "plan", header: t.plan, cell: (row) => <TenantPlanBadge row={row} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} aria-label={ar.common.search} className="ps-9" />
        </div>
        <div className="sm:w-44">
          <Select
            aria-label={t.status}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: ar.common.all },
              { value: "active", label: t.statuses.active },
              { value: "suspended", label: t.statuses.suspended },
            ]}
          />
        </div>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            className="hidden md:block"
            columns={columns}
            rows={data?.data}
            rowKey={(row) => row.id}
            loading={isPending}
            onRowClick={(row) => router.push(`/admin/tenants/${row.id}`)}
            empty={<EmptyState icon={Building2} title={t.empty} className="border-0" />}
          />

          <ul className="flex flex-col gap-3 md:hidden">
            {isPending
              ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
              : data?.data.length === 0
                ? <EmptyState icon={Building2} title={t.empty} />
                : data?.data.map((row) => (
                    <li key={row.id}>
                      <Link href={`/admin/tenants/${row.id}`} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-bold">{row.name}</span>
                          <TenantStatusBadge status={row.status} />
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {row.owner?.name ?? "—"} ·{" "}
                          <span dir="ltr" className="tabular-nums">
                            {row.owner ? formatPhoneLocal(row.owner.phone) : ""}
                          </span>
                        </span>
                        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {t.pages}: {formatNumber(row.pages_count)}
                          </span>
                          <span>
                            {t.orders}: {formatNumber(row.orders_count)}
                          </span>
                          <span>{formatCairo(row.created_at, { withTime: false })}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
          </ul>

          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
