"use client";

import { Copy, CopyPlus, ExternalLink, FileText, Megaphone, MoreHorizontal, Paintbrush, Plus, Send, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { FilterBar, Pagination } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/overlay";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { usePlanLimit, useSession } from "@/lib/auth/session-context";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { deleteLanding, duplicateLanding, PAGE_TABS, pageUrl, publishLanding, unpublishLanding, useLandings, useRefreshLandings, type LandingRow, type PageTab } from "./api";

const t = ar.landings;

export function LandingsPage() {
  const [url, setUrl] = useUrlState(["q", "tab", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const tab = (PAGE_TABS as readonly string[]).includes(url.tab) ? (url.tab as PageTab) : "all";
  const query = useLandings({ q: url.q, tab, page: Math.max(1, Number(url.page) || 1) });
  const limit = usePlanLimit("landing_pages");
  const counts = query.data?.meta.counts;
  const full = limit !== null && counts !== undefined && counts.all >= limit;

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const add = full ? (
    <Button asChild variant="outline">
      <Link href="/dashboard/settings/billing">{t.upgrade}</Link>
    </Button>
  ) : (
    <Button asChild>
      <Link href="/dashboard/marketing/landings/new">
        <Plus />
        {t.add}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t.title}
        description={
          <>
            {t.description}
            {limit !== null && counts ? <span className={full ? "ms-1 font-semibold text-danger" : "ms-1 text-ink-3"}>{full ? t.limitReached : t.limit(counts.all, limit)}</span> : null}
          </>
        }
        actions={add}
        tabs={
          <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v === "all" ? null : v, page: null })}>
            <TabsList>
              {PAGE_TABS.map((k) => (
                <TabsTrigger key={k} value={k} count={counts?.[k]}>
                  {t.tabs[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t.search} />
      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : query.data.data.length === 0 ? (
        url.q || tab !== "all" ? (
          <EmptyState icon={FileText} title={t.noResults} />
        ) : (
          <EmptyState icon={Megaphone} title={t.empty} description={t.emptyText} action={full ? undefined : add} />
        )
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.data.map((page) => (
              <li key={page.id}>
                <LandingCard page={page} />
              </li>
            ))}
          </ul>
          {query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
          ) : null}
        </>
      )}
    </>
  );
}

function LandingCard({ page }: { page: LandingRow }) {
  const { storeUrl } = useSession();
  const refresh = useRefreshLandings();
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const href = pageUrl(storeUrl, page.slug);
  const image = page.product?.image?.medium ?? page.product?.image?.thumb ?? null;
  const published = page.status === "published";

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await refresh();
      setDeleting(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!href) return;
    await navigator.clipboard?.writeText(href).catch(() => undefined);
    toast.success(t.actions.copied);
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-border bg-surface-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
          <img src={image} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-ink-3">
            <FileText className="size-8" aria-hidden />
          </span>
        )}
        <Badge tone={published ? "success" : "neutral"} className="absolute start-3 top-3" dot>
          {t.status[page.status]}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold">{page.title}</h3>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" dir="ltr" className="block truncate text-start text-xs text-ink-3 hover:text-ink hover:underline">
              {href.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
          <p className="mt-1 truncate text-[13px] text-ink-2">
            {page.product ? (page.product.is_active ? page.product.name : `${page.product.name} · ${t.productOff}`) : t.noProduct}
          </p>
          {published && page.has_unpublished_changes ? <p className="mt-1 text-xs text-accent-ink">{t.unpublishedChanges}</p> : null}
        </div>

        {page.stats ? (
          <div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label={t.stats.views} value={formatNumber(page.stats.views)} />
              <Stat label={t.stats.orders} value={formatNumber(page.stats.orders)} />
              <Stat label={t.stats.conversion} value={page.stats.conversion === null ? "—" : formatPercent(page.stats.conversion)} />
            </dl>
            <p className="mt-1 text-center text-[11px] text-ink-3">{t.last30}</p>
          </div>
        ) : null}

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <Tooltip content={t.actions.editSoon}>
            <span className="flex-1">
              <Button variant="outline" className="w-full" disabled>
                <Paintbrush />
                {t.actions.edit}
              </Button>
            </span>
          </Tooltip>
          {published ? null : (
            <Button onClick={() => void run(() => publishLanding(page.id), t.actions.published)} loading={busy}>
              <Send />
              {t.actions.publish}
            </Button>
          )}
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`${t.actions.more}: ${page.title}`}>
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              {href && published ? (
                <MenuItem asChild>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    {t.actions.open}
                  </a>
                </MenuItem>
              ) : null}
              {href ? (
                <MenuItem onSelect={() => void copy()}>
                  <Copy />
                  {t.actions.copy}
                </MenuItem>
              ) : null}
              <MenuItem onSelect={() => void run(() => duplicateLanding(page.id), t.actions.duplicated)}>
                <CopyPlus />
                {t.actions.duplicate}
              </MenuItem>
              {published ? (
                <MenuItem onSelect={() => void run(() => unpublishLanding(page.id), t.actions.unpublished)}>
                  <Undo2 />
                  {t.actions.unpublish}
                </MenuItem>
              ) : null}
              <MenuSeparator />
              <MenuItem destructive onSelect={() => setDeleting(true)}>
                <Trash2 />
                {t.actions.delete}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        {page.updated_at ? <p className="text-[11px] text-ink-3">{formatDateTime(page.updated_at)}</p> : null}
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t.actions.deleteTitle(page.title)}
        description={t.actions.deleteText}
        confirmLabel={t.actions.delete}
        destructive
        loading={busy}
        onConfirm={() => void run(() => deleteLanding(page.id), t.actions.deleted)}
      />
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2">
      <dd className="tabular text-base font-semibold">{value}</dd>
      <dt className="text-[11px] text-ink-3">{label}</dt>
    </div>
  );
}
