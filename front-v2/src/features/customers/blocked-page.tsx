"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Bot, Plus, Search, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Pagination } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/choice";
import { Alert, EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, InputGroup } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Segmented, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, apiPage } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";

const t = ar.orders.blocked;

type Rule = "same_in_row" | "per_day" | "returns";
type Blocked = { id: number; type: "phone" | "ip"; value: string; reason: string | null; rule: Rule | null; customer_id: number | null; created_at: string | null };
const BY = ["all", "auto", "merchant"] as const;
type By = (typeof BY)[number];

export function BlockedPage() {
  const client = useQueryClient();
  const [url, setUrl] = useUrlState(["by", "type", "q", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const by: By = (BY as readonly string[]).includes(url.by) ? (url.by as By) : "all";
  const type = url.type === "ip" ? "ip" : "phone";
  const page = Math.max(1, Number(url.page) || 1);
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<Blocked | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const query = useQuery({
    queryKey: ["blocked", by, type, url.q, page],
    queryFn: () => apiPage<Blocked>("/dashboard/blocked-customers", { query: { by: by === "all" ? null : by, type, q: url.q, page, per_page: 25 } }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["blocked"] }), client.invalidateQueries({ queryKey: ["customers"] })]);

  async function unblock() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/dashboard/blocked-customers/${removing.id}`, { method: "DELETE" });
      toast.success(t.unblocked);
      setRemoving(null);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const rows = query.data?.data ?? [];
  const show = (b: Blocked) => (b.type === "phone" ? formatPhone(b.value) : b.value);

  return (
    <>
      <PageHeader
        crumbs={[{ label: ar.orders.customers.title, href: "/dashboard/customers" }, { label: t.title }]}
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus />
            {t.add}
          </Button>
        }
        tabs={
          <Tabs value={by} onValueChange={(v) => setUrl({ by: v === "all" ? null : v, page: null })}>
            <TabsList>
              {BY.map((b) => (
                <TabsTrigger key={b} value={b}>
                  {t.by[b]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <Panel className="mb-4">
        <PanelBody className="flex flex-col gap-1 py-3 text-sm text-ink-2">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Bot className="size-4" />
            {t.rulesTitle}
          </p>
          <p>{t.rules.store}</p>
          <p>{t.rules.landing}</p>
          <p className="text-xs text-ink-3">{t.rules.exempt}</p>
        </PanelBody>
      </Panel>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup start={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} aria-label={t.search} className="sm:w-72" />
        <Segmented
          value={type}
          onChange={(v) => setUrl({ type: v === "phone" ? null : v, page: null })}
          options={[
            { value: "phone", label: t.type.phone },
            { value: "ip", label: t.type.ip },
          ]}
          className="sm:ms-auto"
        />
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState icon={ShieldCheck} title={url.q ? ar.orders.noResults : t.emptyTitle} description={url.q ? ar.orders.noResultsText : t.emptyText} />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {rows.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-danger-soft text-danger">
                  <Ban className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" className="font-semibold tabular">
                      {show(b)}
                    </span>
                    {b.rule ? (
                      <Badge tone="warning" size="sm">
                        <Bot />
                        {t.ruleLabels[b.rule]}
                      </Badge>
                    ) : (
                      <Badge size="sm">{t.manual}</Badge>
                    )}
                  </p>
                  <p className="text-xs text-ink-3">{[b.reason, formatDateTime(b.created_at)].filter(Boolean).join(" · ")}</p>
                </div>
                {b.customer_id ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/customers/${b.customer_id}`}>
                      <User />
                      {t.customer}
                    </Link>
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => setRemoving(b)}>
                  <ShieldCheck />
                  {t.unblock}
                </Button>
              </li>
            ))}
          </ul>
          {query.data && query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(p) => setUrl({ page: String(p) })} />
          ) : null}
        </>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding ? <AddBlock onClose={() => setAdding(false)} onSaved={refresh} /> : null}
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? t.unblockTitle(show(removing)) : ""}
        description={removing?.rule ? t.unblockAutoText : t.unblockText}
        confirmLabel={t.unblock}
        loading={busy}
        onConfirm={() => void unblock()}
      />
    </>
  );
}

function AddBlock({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<unknown> }) {
  const [type, setType] = React.useState<"phone" | "ip">("phone");
  const [value, setValue] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/dashboard/blocked-customers", { method: "POST", body: { type, value: value.trim(), reason: reason.trim() || null } });
      toast.success(t.added);
      await onSaved();
      onClose();
    } catch (e) {
      setError(isApiError(e) && e.isValidation ? (e.errors.value?.[0] ?? errorMessage(e)) : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent size="sm">
      <DialogHeader title={t.addTitle} />
      <DialogBody className="flex flex-col gap-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <RadioCards
          value={type}
          onValueChange={(v) => setType(v as "phone" | "ip")}
          options={[
            { value: "phone", title: t.type.phone },
            { value: "ip", title: t.type.ip },
          ]}
        />
        <Field label={t.value[type]} htmlFor="block-value" required>
          <Input id="block-value" dir="ltr" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "phone" ? "01012345678" : "41.10.10.10"} />
        </Field>
        <Field label={t.reason} htmlFor="block-reason" optional>
          <Input id="block-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {ar.common.cancel}
        </Button>
        <Button disabled={!value.trim()} loading={busy} onClick={() => void save()}>
          {t.add}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
