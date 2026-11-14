"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, CreditCard, FileText, MessageCircle, RotateCcw, Search, ShoppingCart, Trash2, User, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Pagination } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LockedNotice, Skeleton, toast } from "@/components/ui/feedback";
import { InputGroup } from "@/components/ui/input";
import { Segmented, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, apiPage, type Paginated } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { usePlanFeature, useSession } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { whatsappLink } from "./api";

const t = ar.orders.abandoned;

const KINDS = ["store", "cart", "landing"] as const;
type Kind = (typeof KINDS)[number];
const STATUSES = ["open", "contacted", "converted", "dismissed"] as const;
type LeadStatus = (typeof STATUSES)[number];
const ICONS = { landing: FileText, store: CreditCard, cart: ShoppingCart };

export type Lead = {
  id: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: number | null;
  governorate: string | null;
  quantity: number;
  status: LeadStatus;
  page: { id: number; title: string } | null;
  product: { id: number; name: string } | null;
  source: Kind;
  cart: {
    items: Array<{ product_id: number; name: string; quantity: number }>;
    total: number;
  } | null;
  order: { id: number; number: number } | null;
  contacted_at: string | null;
  last_seen_at: string | null;
  created_at: string;
};

type LeadPage = Paginated<Lead> & {
  meta: Paginated<Lead>["meta"] & {
    counts: Record<LeadStatus, number>;
    sources: Record<Kind, number>;
  };
};

/** "تيشيرت + 2 منتج" from a cart, or the page's product. */
function itemsText(lead: Lead): string {
  const items = lead.cart?.items ?? [];
  if (items.length === 0) return lead.product?.name ?? lead.page?.title ?? "—";
  return ar.orders.itemsSummary(items[0].name, items.length);
}

export function AbandonedPage() {
  const allowed = usePlanFeature("abandoned_leads");
  const session = useSession();
  const client = useQueryClient();
  const [url, setUrl] = useUrlState(["kind", "status", "q", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const kind: Kind = (KINDS as readonly string[]).includes(url.kind) ? (url.kind as Kind) : "store";
  const status: LeadStatus = (STATUSES as readonly string[]).includes(url.status) ? (url.status as LeadStatus) : "open";
  const page = Math.max(1, Number(url.page) || 1);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const query = useQuery({
    queryKey: ["leads", kind, status, url.q, page],
    queryFn: () =>
      apiPage<Lead>("/dashboard/leads", {
        query: { source: kind, status, q: url.q, page, per_page: 20 },
      }) as Promise<LeadPage>,
    placeholderData: keepPreviousData,
    enabled: allowed,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["leads"] });
  const store = session.store_name ?? session.tenant?.name ?? "";

  async function setStatus(lead: Lead, next: "open" | "contacted" | "dismissed") {
    try {
      await api(`/dashboard/leads/${lead.id}`, {
        method: "PATCH",
        body: { status: next },
      });
      toast.success(t.updated);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove(lead: Lead) {
    try {
      await api(`/dashboard/leads/${lead.id}`, { method: "DELETE" });
      toast.success(t.deleted);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const meta = query.data?.meta;
  const rows = query.data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        tabs={
          <Tabs value={kind} onValueChange={(v) => setUrl({ kind: v === "store" ? null : v, page: null })}>
            <TabsList>
              {KINDS.map((k) => (
                <TabsTrigger key={k} value={k} count={status === "open" ? meta?.sources[k] : undefined}>
                  {t.kinds[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {!allowed ? (
        <LockedNotice title={t.lockedTitle} description={t.lockedText} />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2">{t.kindHints[kind]}</p>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup start={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} aria-label={t.search} className="sm:w-72" />
            <Segmented
              value={status}
              onChange={(v) => setUrl({ status: v === "open" ? null : v, page: null })}
              options={STATUSES.map((s) => ({
                value: s,
                label: meta ? `${t.statuses[s]} (${meta.counts[s]})` : t.statuses[s],
              }))}
              className="sm:ms-auto"
            />
          </div>

          {query.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface">
              <EmptyState icon={ICONS[kind]} title={t.emptyTitle} description={url.q ? ar.orders.noResultsText : t.emptyText[kind]} />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {rows.map((lead) => {
                  const Icon = ICONS[lead.source];
                  const name = lead.customer_name ?? (lead.customer_phone ? formatPhone(lead.customer_phone) : t.unknown);
                  return (
                    <li key={lead.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            {name}
                            {lead.customer_phone && lead.customer_name ? (
                              <span className="text-xs font-normal text-ink-3 tabular" dir="ltr">
                                {formatPhone(lead.customer_phone)}
                              </span>
                            ) : null}
                            {!lead.customer_phone ? <Badge size="sm">{t.unknownHint}</Badge> : null}
                            {lead.order ? (
                              <Link href={`/dashboard/orders/${lead.order.id}`} className="text-xs text-brand-strong hover:underline">
                                {t.order(lead.order.number)}
                              </Link>
                            ) : null}
                          </p>
                          <p className="text-sm text-ink-2">
                            {itemsText(lead)} · {t.items(lead.quantity)}
                            {lead.cart ? ` · ${formatMoney(lead.cart.total)}` : ""}
                          </p>
                          <p className="text-xs text-ink-3">{[lead.governorate, formatDateTime(lead.last_seen_at ?? lead.created_at)].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {lead.customer_phone && (lead.status === "open" || lead.status === "contacted") ? (
                          <Button asChild size="sm" onClick={() => lead.status === "open" && void setStatus(lead, "contacted")}>
                            <a href={whatsappLink(lead.customer_phone, t.message(lead.customer_name?.split(" ")[0] ?? "", store, itemsText(lead)))} target="_blank" rel="noopener noreferrer">
                              <MessageCircle />
                              {t.whatsapp}
                            </a>
                          </Button>
                        ) : null}
                        {lead.status === "open" && lead.customer_phone ? (
                          <Button size="sm" variant="secondary" onClick={() => void setStatus(lead, "contacted")}>
                            <CheckCheck />
                            {t.markContacted}
                          </Button>
                        ) : null}
                        {lead.status === "open" || lead.status === "contacted" ? (
                          <Button size="sm" variant="ghost" onClick={() => void setStatus(lead, "dismissed")}>
                            <X />
                            {t.dismiss}
                          </Button>
                        ) : null}
                        {lead.status === "dismissed" ? (
                          <Button size="sm" variant="ghost" onClick={() => void setStatus(lead, "open")}>
                            <RotateCcw />
                            {t.reopen}
                          </Button>
                        ) : null}
                        {lead.customer_id ? (
                          <Button asChild size="icon-sm" variant="ghost" aria-label={ar.orders.detail.customerPage}>
                            <Link href={`/dashboard/customers/${lead.customer_id}`}>
                              <User />
                            </Link>
                          </Button>
                        ) : null}
                        {lead.status !== "converted" ? (
                          <Button size="icon-sm" variant="danger-ghost" aria-label={ar.common.delete} onClick={() => void remove(lead)}>
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {meta && meta.last_page > 1 ? <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onPageChange={(p) => setUrl({ page: String(p) })} /> : null}
            </>
          )}
        </>
      )}
    </>
  );
}
