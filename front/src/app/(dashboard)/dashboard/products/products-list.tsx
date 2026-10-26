"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Copy, MoreVertical, Package, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, Pagination, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { InUseDialog } from "@/components/dashboard/in-use-dialog";
import { MediaThumb } from "@/components/shared/media/media-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { formatPrice } from "@/lib/price";
import { deleteProduct, duplicateProduct, productKeys, toggleProduct, useProducts } from "@/lib/products/api";
import type { PageRef, Product } from "@/lib/types";
import { ar } from "@/messages/ar";

const t = ar.products;

export function ProductsList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search, 300);
  const { data, isPending, isError, error, refetch, isFetching } = useProducts({ q: debounced, active, page });
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [inUse, setInUse] = useState<PageRef[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: productKeys.all });

  async function onToggle(product: Product) {
    try {
      const updated = await toggleProduct(product.id);
      toast.success(t.toggled(updated.is_active));
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function onDuplicate(product: Product) {
    try {
      const copy = await duplicateProduct(product.id);
      toast.success(t.duplicated);
      await refresh();
      router.push(`/dashboard/products/${copy.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
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
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setInUse((err.body.pages as PageRef[] | undefined) ?? []);
        setDeleting(null);
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const actions = (product: Product) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={ar.common.actions} onClick={(event) => event.stopPropagation()}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => router.push(`/dashboard/products/${product.id}`)}>
          <Pencil />
          {ar.common.edit}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDuplicate(product)}>
          <Copy />
          {t.duplicate}
        </DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={() => setDeleting(product)}>
          <Trash2 />
          {ar.common.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: Column<Product>[] = [
    { key: "image", header: t.columns.image, className: "w-16", cell: (p) => <MediaThumb media={p.main_image} className="size-12" /> },
    {
      key: "name",
      header: t.columns.name,
      cell: (p) => (
        <Link href={`/dashboard/products/${p.id}`} className="font-semibold hover:underline">
          {p.name}
          {p.sku ? <span className="block text-xs font-normal text-muted-foreground" dir="ltr">{p.sku}</span> : null}
        </Link>
      ),
    },
    {
      key: "price",
      header: t.columns.price,
      cell: (p) => (
        <span className="whitespace-nowrap">
          <span className="font-semibold">{formatPrice(p.price)}</span>
          {p.compare_at_price ? <span className="ms-2 text-xs text-muted-foreground line-through">{formatPrice(p.compare_at_price)}</span> : null}
        </span>
      ),
    },
    { key: "options", header: t.columns.options, cell: (p) => <span className="text-sm text-muted-foreground">{t.optionsCount(p.options_count ?? 0)}</span> },
    {
      key: "status",
      header: t.columns.status,
      cell: (p) => (
        <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <Switch checked={p.is_active} onCheckedChange={() => onToggle(p)} aria-label={t.fields.active} />
          <Badge variant={p.is_active ? "success" : "secondary"}>{p.is_active ? t.statusActive : t.statusInactive}</Badge>
        </div>
      ),
    },
    { key: "actions", header: <span className="sr-only">{ar.common.actions}</span>, className: "w-12", cell: actions },
  ];

  const filtering = Boolean(debounced || active);
  const rows = data?.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t.searchPlaceholder}
            className="ps-9"
            aria-label={ar.common.search}
          />
        </div>
        <div className="sm:w-48">
          <Select
            aria-label={t.columns.status}
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: t.statusAll },
              { value: "1", label: t.statusActive },
              { value: "0", label: t.statusInactive },
            ]}
          />
        </div>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && rows?.length === 0 && !filtering ? (
        <EmptyState
          icon={Package}
          title={t.emptyTitle}
          description={t.emptyText}
          action={
            <Button asChild>
              <Link href="/dashboard/products/new">{t.addFirst}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} loading={isPending} onRowClick={(p) => router.push(`/dashboard/products/${p.id}`)} className={isFetching ? "opacity-80" : undefined} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {isPending
              ? null
              : rows?.map((product) => (
                  <li key={product.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <MediaThumb media={product.main_image} className="size-16 shrink-0" />
                    <Link href={`/dashboard/products/${product.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{product.name}</p>
                      <p className="text-sm">{formatPrice(product.price)}</p>
                      <p className="text-xs text-muted-foreground">{t.optionsCount(product.options_count ?? 0)}</p>
                    </Link>
                    <Switch checked={product.is_active} onCheckedChange={() => onToggle(product)} aria-label={t.fields.active} />
                    {actions(product)}
                  </li>
                ))}
            {!isPending && rows?.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{ar.common.noResults}</p> : null}
          </ul>
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}

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
      <InUseDialog pages={inUse} title={t.inUseTitle} text={t.inUseText} onClose={() => setInUse(null)} />
    </div>
  );
}
