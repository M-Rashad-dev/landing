"use client";

import { History } from "lucide-react";
import Link from "next/link";
import { DataTable, Pagination, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { useActivity, type AuditRow } from "./api";
import { entitlementLabel } from "./store-dialogs";

const t = ar.admin.activity;
const GROUPS = Object.keys(t.groups);

/** The useful part of a log row: the reason, the plan and days, the limit, the theme, the invoice. */
export function describeLog(row: Pick<AuditRow, "meta" | "target_type" | "target_id">): string | undefined {
  const meta = row.meta ?? {};
  const parts: string[] = [];
  if (row.target_type === "plan" || row.target_type === "theme" || row.target_type === "payment_method") parts.push(row.target_id);
  if (typeof meta.reason === "string") parts.push(meta.reason);
  if (typeof meta.plan_key === "string") parts.push(meta.plan_key);
  if (typeof meta.days === "number") parts.push(ar.admin.store.history.days(meta.days));
  if (typeof meta.entitlement === "string") parts.push(entitlementLabel(meta.entitlement));
  if (typeof meta.theme_key === "string") parts.push(meta.theme_key);
  if (typeof meta.invoice === "string") parts.push(meta.invoice);
  if (typeof meta.refund_ref === "string") parts.push(meta.refund_ref);
  if (typeof meta.email === "string") parts.push(meta.email);
  // Each part is isolated so Arabic and English words (plan keys, numbers) keep their own order.
  return parts.length ? parts.map((part) => `\u2068${part}\u2069`).join(" · ") : undefined;
}

const TONE = (action: string) =>
  action === "tenant.suspend" || action === "payment.reject" || action.endsWith(".delete") || action === "theme.disable"
    ? "danger"
    : action === "payment.approve" || action.endsWith("grant") || action === "tenant.activate" || action === "theme.enable"
      ? "success"
      : "neutral";

export function ActivityPage() {
  const [url, setUrl] = useUrlState(["action", "tenant", "page"] as const);
  const action = GROUPS.includes(url.action) ? url.action : "all";
  const tenant = Number(url.tenant) || undefined;
  const query = useActivity({ action: action === "all" ? undefined : action, tenant, page: Math.max(1, Number(url.page) || 1) });

  const columns: Column<AuditRow>[] = [
    {
      key: "action",
      header: t.columns.action,
      cell: (r) => (
        <Badge tone={TONE(r.action)} size="sm" dot>
          {ar.admin.actions[r.action] ?? r.action}
        </Badge>
      ),
    },
    {
      key: "store",
      header: t.columns.store,
      cell: (r) =>
        r.tenant ? (
          <Link href={`/admin/stores/${r.tenant.id}`} className="font-semibold hover:underline">
            {r.tenant.name || `#${r.tenant.id}`}
          </Link>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    { key: "details", header: t.columns.details, hideOnMobile: true, cell: (r) => <span className="line-clamp-2 text-sm text-ink-2">{describeLog(r) ?? "—"}</span> },
    { key: "by", header: t.columns.by, hideOnMobile: true, cell: (r) => <span className="text-sm">{r.admin?.name ?? "—"}</span> },
    {
      key: "at",
      header: t.columns.at,
      cell: (r) => (
        <span className="flex flex-col">
          <span className="tabular text-xs">{formatDateTime(r.created_at)}</span>
          {r.ip ? (
            <span dir="ltr" className="tabular text-start text-[11px] text-ink-3">
              {r.ip}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Select
            aria-label={t.filterLabel}
            value={action}
            onValueChange={(v) => setUrl({ action: v === "all" ? null : v, page: null })}
            options={GROUPS.map((g) => ({ value: g, label: t.groups[g] }))}
            searchable={false}
            className="w-52"
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
            empty={<EmptyState icon={History} title={t.empty} description={t.emptyText} />}
          />
          {query.data && query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
          ) : null}
        </>
      )}
    </>
  );
}
