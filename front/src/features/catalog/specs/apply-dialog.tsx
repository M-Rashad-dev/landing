"use client";

import { Search } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Thumb } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { useCategories } from "../categories/api";
import { useProducts } from "../products/api";
import { applySpecGroup, useRefreshSpecs, type SpecGroup } from "./api";

const t = ar.specs.applyDialog;
const MAX = 500;

/** «أضف المجموعة لمنتجات»: search + category filter + check boxes, then one request. */
export function ApplyDialog({ group, open, onOpenChange }: { group: SpecGroup; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {/* The body unmounts when the dialog closes: every open starts with nothing chosen. */}
        <ApplyBody group={group} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ApplyBody({ group, onDone }: { group: SpecGroup; onDone: () => void }) {
  const refresh = useRefreshSpecs();
  const categories = useCategories();
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [chosen, setChosen] = React.useState<Set<number>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const products = useProducts({
    q: search,
    status: "all",
    category: category ? Number(category) : null,
    sort: "name",
    page,
  });

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const rows = products.data?.data ?? [];
  const meta = products.data?.meta;
  const pageIds = rows.map((p) => p.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => chosen.has(id));
  const someOnPage = pageIds.some((id) => chosen.has(id));

  function toggle(id: number, on: boolean) {
    setChosen((old) => {
      const next = new Set(old);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(on: boolean) {
    setChosen((old) => {
      const next = new Set(old);
      for (const id of pageIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function submit() {
    if (chosen.size === 0) return;
    if (chosen.size > MAX) {
      toast.error(t.max);
      return;
    }
    setSaving(true);
    try {
      const result = await applySpecGroup(group.id, [...chosen]);
      toast.success(t.done(result.added, result.skipped));
      await refresh();
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader title={t.title} description={t.description} />
      <div className="flex flex-col gap-2 border-b border-border px-5 py-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} className="ps-9" />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
          emptyLabel={t.allCategories}
          options={(categories.data ?? []).map((c) => ({
            value: String(c.id),
            label: `${"— ".repeat(c.depth)}${c.name}`,
          }))}
          className="sm:w-56"
          aria-label={t.allCategories}
        />
      </div>
      <DialogBody className="p-0">
        {products.isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : products.isError ? (
          <ErrorState onRetry={() => void products.refetch()} message={errorMessage(products.error)} />
        ) : rows.length === 0 ? (
          <EmptyState compact title={t.empty} />
        ) : (
          <ul>
            <li className="flex items-center gap-3 border-b border-border bg-surface-2/50 px-5 py-2">
              <Checkbox id="spec-apply-page" checked={allOnPage ? true : someOnPage ? "indeterminate" : false} onCheckedChange={(v) => togglePage(v === true)} />
              <label htmlFor="spec-apply-page" className="text-[13px] font-semibold text-ink-2">
                {t.selectPage}
              </label>
            </li>
            {rows.map((product) => (
              <li key={product.id} className="border-b border-border last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-surface-2/40">
                  <Checkbox checked={chosen.has(product.id)} onCheckedChange={(v) => toggle(product.id, v === true)} />
                  <Thumb src={product.main_image?.urls.thumb} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{product.name}</span>
                    <span className="text-xs text-ink-3">{product.categories.map((c) => c.name).join("، ") || product.sku || ""}</span>
                  </span>
                  <span className="tabular text-[13px] text-ink-2">{formatMoney(product.price)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </DialogBody>
      {meta && meta.last_page > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-5 py-2 text-xs text-ink-3">
          <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t.prev}
          </Button>
          <span className="tabular">{ar.specs.grid.page(meta.current_page, meta.last_page)}</span>
          <Button type="button" variant="ghost" size="sm" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
            {t.next}
          </Button>
        </div>
      ) : null}
      <DialogFooter className="sm:items-center">
        <span className="text-[13px] text-ink-2 sm:me-auto">{t.selected(chosen.size)}</span>
        {chosen.size > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setChosen(new Set())}>
            {t.clear}
          </Button>
        ) : null}
        <Button type="button" onClick={() => void submit()} loading={saving} disabled={chosen.size === 0}>
          {t.submit(chosen.size)}
        </Button>
      </DialogFooter>
    </>
  );
}
