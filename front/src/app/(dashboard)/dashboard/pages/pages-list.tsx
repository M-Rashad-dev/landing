"use client";

import { PlanLockedBadge } from "@/components/billing/plan";

import { useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, FileText, Home, MoreVertical, PenSquare, Search, Settings, Star, Trash2, Upload, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Pagination } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { useSession, useSiteUrl } from "@/components/dashboard/session-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { deletePage, duplicatePage, pageKeys, publishPage, setHomePage, unpublishPage, usePages, type Blocker, type PageSummary } from "@/lib/pages/api";
import { getTheme } from "@/themes/registry";
import { ar } from "@/messages/ar";

const t = ar.pages;

export function PagesList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const toSite = useSiteUrl();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search, 300);
  const { data, isPending, isError, error, refetch } = usePages({ q: debounced, status, page });
  const [deleting, setDeleting] = useState<PageSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: pageKeys.all });
  const urlOf = (p: PageSummary) => toSite(session.primary_host, p.is_home ? "/" : `/${p.slug}`);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      await refresh();
    } catch (err) {
      if (isApiError(err) && err.code === "publish_blocked") {
        const blockers = (err.body.blockers as Blocker[] | undefined) ?? [];
        toast.error(blockers.map((b) => b.message).join(" • ") || err.message);
      } else toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    await run(() => deletePage(deleting.id), t.deleted);
    setBusy(false);
    setDeleting(null);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    toast.success(t.linkCopied);
  }

  const filtering = Boolean(debounced || status);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => (setSearch(e.target.value), setPage(1))} placeholder={t.searchPlaceholder} className="ps-9" aria-label={ar.common.search} />
        </div>
        <div className="sm:w-44">
          <Select
            aria-label={t.statusAll}
            value={status}
            onChange={(e) => (setStatus(e.target.value), setPage(1))}
            options={[
              { value: "", label: t.statusAll },
              { value: "published", label: t.status.published },
              { value: "draft", label: t.status.draft },
            ]}
          />
        </div>
      </div>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.data.length === 0 && !filtering ? (
        <EmptyState
          icon={FileText}
          title={t.emptyTitle}
          description={t.emptyText}
          action={
            <Button asChild>
              <Link href="/dashboard/pages/new">{t.new}</Link>
            </Button>
          }
        />
      ) : data.data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{ar.common.noResults}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/pages/${p.id}/builder`} className="flex items-center gap-1.5 font-bold hover:underline">
                      {p.is_home ? <Star className="size-4 shrink-0 fill-amber-400 text-amber-400" aria-label={t.home} /> : null}
                      <span className="truncate">{p.title}</span>
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {getTheme(p.theme_key).name} · {p.product?.name ?? t.noProduct}
                    </p>
                  </div>
                  <Badge variant={p.status === "published" ? "success" : "secondary"}>{t.status[p.status]}</Badge>
                  <PlanLockedBadge locked={p.locked_by_plan} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={ar.common.actions}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => router.push(`/dashboard/pages/${p.id}/builder`)}>
                        <PenSquare />
                        {t.openBuilder}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => router.push(`/dashboard/pages/${p.id}`)}>
                        <Settings />
                        {t.settings}
                      </DropdownMenuItem>
                      {p.status === "published" ? (
                        <DropdownMenuItem onSelect={() => run(() => unpublishPage(p.id), t.unpublished)}>
                          <EyeOff />
                          {t.unpublish}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => run(() => publishPage(p.id), t.published)}>
                          <Upload />
                          {t.publish}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => run(() => duplicatePage(p.id), t.duplicated)}>
                        <Copy />
                        {t.duplicate}
                      </DropdownMenuItem>
                      {!p.is_home && p.status === "published" ? (
                        <DropdownMenuItem onSelect={() => run(() => setHomePage(p.id), t.homeSet)}>
                          <Home />
                          {t.setHome}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setDeleting(p)}>
                        <Trash2 />
                        {ar.common.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs" dir="ltr">
                    {urlOf(p)}
                  </span>
                  <Button variant="ghost" size="icon-sm" onClick={() => copy(urlOf(p))} aria-label={t.copyLink}>
                    <Copy />
                  </Button>
                  {p.status === "published" ? (
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a href={urlOf(p)} target="_blank" rel="noopener noreferrer" aria-label={t.viewLive}>
                        <ExternalLink />
                      </a>
                    </Button>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {t.lastEdit}: {formatCairo(p.updated_at)}
                  </span>
                  {p.has_unpublished_changes ? <Badge variant="warning">{t.unpublishedChanges}</Badge> : null}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/pages/${p.id}/builder`}>
                    <PenSquare />
                    {t.openBuilder}
                  </Link>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pagination meta={data?.meta} onPageChange={setPage} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.deleteTitle}
        description={t.deleteText}
        confirmLabel={ar.common.delete}
        destructive
        loading={busy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
