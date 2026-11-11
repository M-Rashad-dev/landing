"use client";

import { Eye, EyeOff, FolderMinus, FolderPlus, Package, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Pagination } from "@/components/data/data-table";
import { Meter } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { InputGroup } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { usePlanLimit, useSession } from "@/lib/auth/session-context";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { pathOf, useCategories } from "../categories/api";
import { bulkProducts, deleteProduct, duplicateProduct, SORTS, STATUSES, toggleProduct, useProducts, useRefreshProducts, type BulkAction, type ProductCard as Product, type Sort, type Status } from "./api";
import { ProductCard } from "./product-card";

const t = ar.catalog.products;

export function ProductsPage() {
  const router = useRouter();
  const session = useSession();
  const limit = usePlanLimit("products");
  const [url, setUrl] = useUrlState(["q", "status", "category", "sort", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const filters = {
    q: url.q,
    status: (STATUSES as readonly string[]).includes(url.status) ? (url.status as Status) : "all",
    category: url.category ? Number(url.category) : null,
    sort: (SORTS as readonly string[]).includes(url.sort) ? (url.sort as Sort) : "latest",
    page: Math.max(1, Number(url.page) || 1),
  };
  const query = useProducts(filters);
  const categories = useCategories();
  const refresh = useRefreshProducts();
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [deleting, setDeleting] = React.useState<Product | null>(null);
  const [inUse, setInUse] = React.useState<Array<{ id: number; title: string }> | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const id = window.setTimeout(() => search !== url.q && setUrl({ q: search.trim() || null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const items = query.data?.data ?? [];
  const counts = query.data?.meta.counts;
  const allCategories = categories.data ?? [];
  const filtered = Boolean(filters.q || filters.category || filters.status !== "all");

  async function onToggle(p: Product) {
    try {
      const updated = await toggleProduct(p.id);
      toast.success(t.toggled(updated.is_active));
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function onDuplicate(p: Product) {
    try {
      const copy = await duplicateProduct(p.id);
      toast.success(t.duplicated);
      await refresh();
      router.push(`/dashboard/catalog/products/${copy.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteProduct(deleting.id);
      toast.success(t.deleted);
      setDeleting(null);
      await refresh();
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setInUse((error.body.pages as Array<{ id: number; title: string }> | undefined) ?? []);
        setDeleting(null);
      } else toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const categoryOptions = allCategories.map((c) => ({ value: String(c.id), label: c.name, hint: pathOf(allCategories, c) || undefined }));

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button asChild>
            <Link href="/dashboard/catalog/products/new">
              <Plus />
              {t.add}
            </Link>
          </Button>
        }
        tabs={
          <Tabs value={filters.status} onValueChange={(v) => setUrl({ status: v === "all" ? null : v })}>
            <TabsList>
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s} count={counts?.[s]}>
                  {t.tabs[s]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {limit !== null && counts ? (
        <div className="mb-4 max-w-xs">
          <Meter used={counts.all} limit={limit} label={t.title} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup start={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} aria-label={t.search} className="sm:w-72" />
        <Select
          aria-label={t.categoryLabel}
          value={url.category}
          onValueChange={(v) => setUrl({ category: v || null })}
          options={categoryOptions}
          emptyLabel={t.allCategories}
          className="sm:w-56"
        />
        <Select aria-label={t.sortLabel} value={filters.sort} onValueChange={(v) => setUrl({ sort: v === "latest" ? null : v })} options={SORTS.map((s) => ({ value: s, label: t.sort[s] }))} searchable={false} className="sm:ms-auto sm:w-52" />
      </div>

      {selected.size > 0 ? (
        <BulkBar
          ids={[...selected]}
          pageIds={items.map((p) => p.id)}
          categories={categoryOptions}
          onSelectPage={(on) => setSelected(on ? new Set(items.map((p) => p.id)) : new Set())}
          onDone={async () => {
            setSelected(new Set());
            await refresh();
          }}
        />
      ) : null}

      {query.isPending ? (
        <Grid>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="flex flex-col gap-2 p-3.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            </div>
          ))}
        </Grid>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          {filtered ? (
            <EmptyState
              icon={Search}
              title={t.noResults}
              description={t.noResultsText}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setUrl({ q: null, status: null, category: null });
                  }}
                >
                  {t.clearFilters}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title={t.emptyTitle}
              description={t.emptyText}
              action={
                <Button asChild>
                  <Link href="/dashboard/catalog/products/new">
                    <Plus />
                    {t.add}
                  </Link>
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <>
          <Grid>
            {items.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                categories={allCategories}
                storeUrl={session.storeUrl}
                selected={selected.has(p.id)}
                onSelect={(on) => setSelected((s) => (on ? new Set([...s, p.id]) : new Set([...s].filter((x) => x !== p.id))))}
                onChanged={refresh}
                onToggle={() => void onToggle(p)}
                onDuplicate={() => void onDuplicate(p)}
                onDelete={() => setDeleting(p)}
              />
            ))}
          </Grid>
          {query.data ? <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} /> : null}
        </>
      )}

      <ConfirmDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)} title={deleting ? t.deleteTitle(deleting.name) : ""} description={t.deleteText} confirmLabel={ar.common.delete} destructive loading={busy} onConfirm={() => void confirmDelete()} />
      <Dialog open={inUse !== null} onOpenChange={(o) => !o && setInUse(null)}>
        <DialogContent size="sm">
          <DialogHeader title={t.inUseTitle} description={t.inUseText} />
          <DialogBody>
            <ul className="list-disc ps-5 text-sm">
              {inUse?.map((page) => (
                <li key={page.id}>{page.title}</li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setInUse(null)}>{ar.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}

function BulkBar({ ids, pageIds, categories, onSelectPage, onDone }: { ids: number[]; pageIds: number[]; categories: Array<{ value: string; label: string; hint?: string }>; onSelectPage: (on: boolean) => void; onDone: () => Promise<unknown> }) {
  const b = t.bulk;
  const [busy, setBusy] = React.useState<BulkAction | null>(null);
  const [asking, setAsking] = React.useState<"add_category" | "remove_category" | "delete" | null>(null);
  const [categoryId, setCategoryId] = React.useState("");
  const allOnPage = pageIds.every((id) => ids.includes(id));

  async function run(action: BulkAction, category?: number) {
    setBusy(action);
    try {
      const result = await bulkProducts(action, ids, category);
      toast.success(b.done(result.done));
      if (result.skipped.length) toast.warning(b.skipped(result.skipped.map((s) => s.name).join("، ")));
      setAsking(null);
      setCategoryId("");
      await onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-brand-soft px-3 py-2 shadow-sm">
      <label className="flex items-center gap-2 text-sm font-semibold text-brand-strong">
        <Checkbox checked={allOnPage} onCheckedChange={(v) => onSelectPage(v === true)} aria-label={b.selectAll} />
        {b.selected(ids.length)}
      </label>
      <div className="flex flex-wrap items-center gap-1.5 sm:ms-auto">
        <Button size="sm" variant="secondary" loading={busy === "activate"} onClick={() => void run("activate")}>
          <Eye />
          {b.activate}
        </Button>
        <Button size="sm" variant="secondary" loading={busy === "deactivate"} onClick={() => void run("deactivate")}>
          <EyeOff />
          {b.deactivate}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setAsking("add_category")}>
          <FolderPlus />
          {b.addCategory}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setAsking("remove_category")}>
          <FolderMinus />
          {b.removeCategory}
        </Button>
        <Button size="sm" variant="danger-ghost" onClick={() => setAsking("delete")}>
          <Trash2 />
          {b.delete}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => onSelectPage(false)} aria-label={b.clear}>
          <X />
        </Button>
      </div>

      <Dialog open={asking === "add_category" || asking === "remove_category"} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent size="sm">
          <DialogHeader title={asking === "remove_category" ? b.removeCategory : b.addCategory} description={b.selected(ids.length)} />
          <DialogBody>
            <Select aria-label={b.pickCategory} value={categoryId} onValueChange={setCategoryId} options={categories} placeholder={b.pickCategory} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsking(null)}>
              {ar.common.cancel}
            </Button>
            <Button disabled={!categoryId} loading={busy === asking} onClick={() => asking && asking !== "delete" && void run(asking, Number(categoryId))}>
              {ar.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={asking === "delete"} onOpenChange={(o) => !o && setAsking(null)} title={b.deleteTitle(ids.length)} description={b.deleteText} confirmLabel={b.delete} destructive loading={busy === "delete"} onConfirm={() => void run("delete")} />
    </div>
  );
}
