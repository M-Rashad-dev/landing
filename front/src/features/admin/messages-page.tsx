"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/data/data-table";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatPhoneLocal } from "@/lib/phone";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import {
  MESSAGE_PURPOSES,
  MESSAGE_STATUSES,
  pushTemplates,
  useMessages,
  useMessagesOverview,
  type MessageFilters,
  type MessagePurpose,
  type MessageRow,
  type MessagesOverview,
  type MessageStatus,
  type TemplateRow,
} from "./api";

const t = ar.admin.messages;

const TEMPLATE_TONE: Record<string, Tone> = { APPROVED: "success", PENDING: "warning", REJECTED: "danger", PAUSED: "danger", DISABLED: "danger", MISSING: "neutral" };
const STATUS_TONE: Record<MessageStatus, Tone> = { pending: "neutral", sent: "info", delivered: "brand-soft", read: "success", failed: "danger" };
const QUALITY_TONE: Record<string, Tone> = { GREEN: "success", YELLOW: "warning", RED: "danger" };

/** "order_received_v1" → "order_received" (the use doesn't change between versions). */
const templateKey = (name: string) => name.replace(/_v\d+$/, "");

export function MessagesPage() {
  const overview = useMessagesOverview();

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {overview.isError ? (
        <ErrorState onRetry={() => void overview.refetch()} message={errorMessage(overview.error)} />
      ) : (
        <div className="flex flex-col gap-5">
          <Connection data={overview.data} />
          <Stats data={overview.data} />
          {overview.data?.configured && !overview.data.error ? <Templates rows={overview.data.templates} /> : null}
          <MessageLog />
        </div>
      )}
    </>
  );
}

function Connection({ data }: { data: MessagesOverview | undefined }) {
  if (!data) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data.configured) {
    return (
      <Alert tone="warning" title={t.notConfigured}>
        {t.notConfiguredText}
      </Alert>
    );
  }
  if (data.error || !data.phone) {
    return (
      <Alert tone="danger" title={t.metaError}>
        {t.metaErrorText(data.error ?? "")}
      </Alert>
    );
  }

  const phone = data.phone;
  return (
    <Panel>
      <PanelBody className="flex flex-wrap items-center gap-x-10 gap-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-success-soft text-success">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <p className="text-[13px] text-ink-3">{t.number}</p>
            <p dir="ltr" className="tabular text-start font-semibold">
              {phone.number}
            </p>
          </div>
        </div>
        <div>
          <p className="text-[13px] text-ink-3">{t.name}</p>
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {phone.name}
            <Badge tone={phone.name_status === "DECLINED" ? "danger" : phone.name_status === "PENDING_REVIEW" ? "warning" : "success"} size="sm">
              {t.nameStatuses[phone.name_status] ?? phone.name_status}
            </Badge>
          </p>
        </div>
        <div>
          <p className="text-[13px] text-ink-3">{t.quality}</p>
          <Badge tone={QUALITY_TONE[phone.quality] ?? "neutral"} dot>
            {t.qualities[phone.quality] ?? t.qualities.UNKNOWN}
          </Badge>
        </div>
      </PanelBody>
    </Panel>
  );
}

function Stats({ data }: { data: MessagesOverview | undefined }) {
  const loading = !data;
  const month = data?.month ?? { total: 0, delivered: 0, read: 0, failed: 0 };
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label={t.stats.today} value={formatNumber(data?.today.total ?? 0)} loading={loading} />
      <StatCard label={`${t.stats.delivered} · ${t.stats.month}`} value={formatNumber(month.delivered)} hint={t.stats.ofTotal(month.delivered, month.total)} loading={loading} />
      <StatCard label={`${t.stats.read} · ${t.stats.month}`} value={formatNumber(month.read)} hint={t.stats.ofTotal(month.read, month.total)} loading={loading} />
      <StatCard label={`${t.stats.failed} · ${t.stats.month}`} value={formatNumber(month.failed)} hint={t.stats.ofTotal(month.failed, month.total)} attention={month.failed > 0} loading={loading} />
    </div>
  );
}

function Templates({ rows }: { rows: TemplateRow[] }) {
  const queryClient = useQueryClient();
  const missing = rows.some((r) => r.status === "MISSING");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const push = useMutation({
    mutationFn: pushTemplates,
    onSuccess: (result) => {
      setErrors(result.errors);
      const failed = Object.keys(result.errors).length;
      if (failed) toast.error(t.templates.pushFailed(failed));
      else toast.success(result.submitted.length ? t.templates.pushed(result.submitted.length) : t.templates.nothingToPush);
      if (result.skipped.length) toast.warning(t.templates.skippedLocal(result.skipped.length));
      queryClient.setQueryData<MessagesOverview>(["admin", "messages", "overview"], (old) => (old ? { ...old, templates: result.templates } : old));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const columns: Column<TemplateRow>[] = [
    {
      key: "template",
      header: t.templates.columns.template,
      cell: (r) => (
        <span dir="ltr" className="font-mono text-[13px]">
          {r.name}
        </span>
      ),
    },
    { key: "use", header: t.templates.columns.use, hideOnMobile: true, cell: (r) => <span className="text-sm text-ink-2">{t.templates.uses[templateKey(r.name)] ?? "—"}</span> },
    {
      key: "status",
      header: t.templates.columns.status,
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={TEMPLATE_TONE[r.status] ?? "neutral"} size="sm" dot>
            {t.templates.status[r.status] ?? r.status}
          </Badge>
          {r.rejected_reason || errors[r.name] ? <span className="text-xs text-danger">{r.rejected_reason ?? errors[r.name]}</span> : null}
        </span>
      ),
    },
  ];

  return (
    <Panel>
      <PanelHeader
        title={t.templates.title}
        description={t.templates.description}
        actions={
          missing ? (
            <Button size="sm" loading={push.isPending} onClick={() => push.mutate()}>
              <Send />
              {t.templates.push}
            </Button>
          ) : null
        }
      />
      <PanelBody>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.name} />
      </PanelBody>
    </Panel>
  );
}

function MessageLog() {
  const [url, setUrl] = useUrlState(["status", "purpose", "phone", "page"] as const);
  const [search, setSearch] = React.useState(url.phone);
  const filters: MessageFilters = {
    status: (MESSAGE_STATUSES as readonly string[]).includes(url.status) ? (url.status as MessageStatus) : undefined,
    purpose: (MESSAGE_PURPOSES as readonly string[]).includes(url.purpose) ? (url.purpose as MessagePurpose) : undefined,
    phone: url.phone || undefined,
    page: Math.max(1, Number(url.page) || 1),
  };
  const query = useMessages(filters);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.phone && setUrl({ phone: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.phone, setUrl]);

  const columns: Column<MessageRow>[] = [
    {
      key: "to",
      header: t.log.columns.to,
      cell: (r) => (
        <span dir="ltr" className="tabular text-start font-semibold">
          {formatPhoneLocal(r.recipient)}
        </span>
      ),
    },
    { key: "purpose", header: t.log.columns.purpose, cell: (r) => <span className="text-sm">{t.log.purpose[r.purpose] ?? r.purpose}</span> },
    {
      key: "store",
      header: t.log.columns.store,
      hideOnMobile: true,
      cell: (r) =>
        r.tenant ? (
          <Link href={`/admin/stores/${r.tenant.id}`} className="font-semibold hover:underline">
            {r.tenant.name || `#${r.tenant.id}`}
          </Link>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: "status",
      header: t.log.columns.status,
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={STATUS_TONE[r.status]} size="sm" dot>
            {t.log.status[r.status] ?? r.status}
          </Badge>
          {r.error ? <span className="line-clamp-2 text-xs text-danger">{r.error}</span> : null}
        </span>
      ),
    },
    { key: "at", header: t.log.columns.at, cell: (r) => <span className="tabular text-xs">{formatDateTime(r.created_at)}</span> },
  ];

  const filtered = Boolean(filters.status || filters.purpose || filters.phone);

  return (
    <Panel>
      <PanelHeader title={t.log.title} />
      <PanelBody>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.log.search}
          filters={
            <>
              <Select
                aria-label={t.log.statusLabel}
                value={filters.status ?? "all"}
                onValueChange={(v) => setUrl({ status: v === "all" ? null : v, page: null })}
                options={[{ value: "all", label: t.log.allStatuses }, ...MESSAGE_STATUSES.map((s) => ({ value: s, label: t.log.status[s] }))]}
                searchable={false}
                className="w-36"
              />
              <Select
                aria-label={t.log.purposeLabel}
                value={filters.purpose ?? "all"}
                onValueChange={(v) => setUrl({ purpose: v === "all" ? null : v, page: null })}
                options={[{ value: "all", label: t.log.allPurposes }, ...MESSAGE_PURPOSES.map((p) => ({ value: p, label: t.log.purpose[p] }))]}
                searchable={false}
                className="w-40"
              />
            </>
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
              empty={<EmptyState icon={MessageCircle} title={t.log.empty} description={filtered ? undefined : t.log.emptyText} />}
            />
            {query.data && query.data.meta.last_page > 1 ? (
              <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
            ) : null}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
