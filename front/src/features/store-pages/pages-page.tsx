"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { SortableList } from "@/components/data/sortable-list";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { deleteStorePage, inputOf, MAX_PAGES, reorderStorePages, saveStorePage, storePageKeys, template, TEMPLATE_KEYS, useStorePages, type StorePage, type TemplateKey } from "./api";

const t = ar.storePages;

export function StorePagesPage() {
  const session = useSession();
  const client = useQueryClient();
  const query = useStorePages();
  const [removing, setRemoving] = React.useState<StorePage | null>(null);
  const [busy, setBusy] = React.useState(false);

  const pages = query.data ?? [];
  const usedSlugs = new Set(pages.map((p) => p.slug));
  const missing = TEMPLATE_KEYS.filter((k) => !usedSlugs.has(template(k).slug));
  const full = pages.length >= MAX_PAGES;

  const reorder = async (next: StorePage[]) => {
    client.setQueryData(storePageKeys.all, next);
    try {
      await reorderStorePages(next.map((p) => p.id));
      toast.success(t.orderSaved);
    } catch (error) {
      toast.error(errorMessage(error));
      void client.invalidateQueries({ queryKey: storePageKeys.all });
    }
  };

  const togglePublished = async (page: StorePage, value: boolean) => {
    client.setQueryData<StorePage[]>(storePageKeys.all, (rows) => rows?.map((p) => (p.id === page.id ? { ...p, is_published: value } : p)));
    try {
      await saveStorePage({ ...inputOf(page), is_published: value }, page.id);
      toast.success(value ? t.shownToast : t.hiddenToast);
    } catch (error) {
      toast.error(errorMessage(error));
      void client.invalidateQueries({ queryKey: storePageKeys.all });
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteStorePage(removing.id);
      toast.success(t.deleted);
      setRemoving(null);
      await client.invalidateQueries({ queryKey: storePageKeys.all });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          full ? null : (
            <Button asChild>
              <Link href="/dashboard/design/pages/new">
                <Plus />
                {t.add}
              </Link>
            </Button>
          )
        }
      />

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : query.isPending ? (
        <Skeleton className="h-60" />
      ) : (
        <div className="flex flex-col gap-6">
          {pages.length === 0 ? (
            <EmptyState icon={FileText} title={t.emptyTitle} description={t.emptyText} />
          ) : (
            <div className="flex flex-col gap-2">
              <SortableList
                items={pages}
                getId={(p) => String(p.id)}
                onReorder={(next) => void reorder(next)}
                render={(page) => (
                  <div className="flex items-center gap-3">
                    <Link href={`/dashboard/design/pages/${page.id}`} className="flex min-w-0 flex-1 flex-col hover:underline">
                      <span className="flex items-center gap-2 font-semibold">
                        {page.title}
                        {!page.is_published ? (
                          <Badge tone="neutral" size="sm">
                            {t.hidden}
                          </Badge>
                        ) : null}
                      </span>
                      <span dir="ltr" className="truncate text-end text-xs text-ink-3">
                        /pages/{page.slug}
                      </span>
                    </Link>
                    <Switch checked={page.is_published} onCheckedChange={(v) => void togglePublished(page, v)} aria-label={t.visible} />
                    <Menu>
                      <MenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={ar.common.more}>
                          <MoreHorizontal />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem asChild>
                          <Link href={`/dashboard/design/pages/${page.id}`}>
                            <Pencil />
                            {t.edit}
                          </Link>
                        </MenuItem>
                        {session.storeUrl && page.is_published ? (
                          <MenuItem asChild>
                            <a href={`${session.storeUrl}/pages/${encodeURIComponent(page.slug)}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink />
                              {t.view}
                            </a>
                          </MenuItem>
                        ) : null}
                        <MenuSeparator />
                        <MenuItem destructive onSelect={() => setRemoving(page)}>
                          <Trash2 />
                          {t.delete}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                )}
              />
              <p className="text-xs text-ink-3">{full ? t.limit(MAX_PAGES) : t.dragHint}</p>
            </div>
          )}

          {missing.length && !full ? (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="font-display text-base font-semibold">{pages.length ? t.suggested : t.templatesTitle}</h2>
                <p className="text-[13px] text-ink-3">{t.templatesHint}</p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {missing.map((key: TemplateKey) => (
                  <li key={key}>
                    <Link href={`/dashboard/design/pages/new?template=${key}`} className="flex h-full flex-col gap-1 rounded-xl border border-dashed border-border-strong bg-surface p-4 transition-colors hover:border-brand hover:bg-brand-soft/40">
                      <span className="flex items-center gap-2 font-semibold">
                        <FileText className="size-4 text-brand-strong" aria-hidden />
                        {template(key).title}
                      </span>
                      <span className="text-[13px] text-ink-3">{template(key).hint}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? t.deleteTitle(removing.title) : ""}
        description={t.deleteText}
        confirmLabel={t.delete}
        destructive
        loading={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
