"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Save, TableProperties } from "lucide-react";
import * as React from "react";
import { useUnsavedWarning } from "@/components/forms/form-layout";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Thumb } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { ApplyDialog } from "./apply-dialog";
import { saveSpecGrid, specKeys, useSpecGrid, type SpecGroup } from "./api";

const t = ar.specs.grid;

/** Changed cells: product id → label → the typed text. */
type Edits = Record<number, Record<string, string>>;

/**
 * «املأ القيم»: one row per product using the group, one column per label (Excel-like). Tab moves to the next cell,
 * Enter to the same cell of the next product; changed cells are highlighted and «احفظ» sends the changed products only.
 */
export function FillGrid({ group }: { group: SpecGroup }) {
  const client = useQueryClient();
  const can = useCan();
  const canEdit = can("products.update");
  const [page, setPage] = React.useState(1);
  const [edits, setEdits] = React.useState<Edits>({});
  const [saving, setSaving] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const query = useSpecGrid(group.id, page);
  const changed = Object.keys(edits).length;
  useUnsavedWarning(changed > 0);

  const labels = query.data?.meta.labels ?? [];
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  function setCell(productId: number, label: string, text: string, base: string | null) {
    setEdits((old) => {
      const row = { ...(old[productId] ?? {}) };
      if (text.trim() === (base ?? "").trim()) delete row[label];
      else row[label] = text;
      const next = { ...old };
      if (Object.keys(row).length === 0) delete next[productId];
      else next[productId] = row;
      return next;
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const target = document.querySelector<HTMLInputElement>(`input[data-grid="${group.id}"][data-row="${row + (event.shiftKey ? -1 : 1)}"][data-col="${col}"]`);
    target?.focus();
    target?.select();
  }

  async function save() {
    const body = Object.entries(edits).map(([id, values]) => ({
      product_id: Number(id),
      values: Object.entries(values).map(([label, value]) => ({
        label,
        value: value.trim() || null,
      })),
    }));
    if (body.length === 0) return;
    setSaving(true);
    try {
      const { updated } = await saveSpecGrid(group.id, body);
      toast.success(t.saved(updated));
      setEdits({});
      await Promise.all([
        client.invalidateQueries({
          queryKey: ["spec-groups", "grid", group.id],
        }),
        client.invalidateQueries({ queryKey: specKeys.detail(group.id) }),
        client.invalidateQueries({ queryKey: ["products"] }),
      ]);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function goTo(next: number) {
    if (changed > 0) {
      toast.error(t.saveBeforePaging);
      return;
    }
    setPage(next);
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  if (labels.length === 0) return <EmptyState icon={TableProperties} title={t.noLabels} className="rounded-xl border border-border bg-surface" />;
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState
          icon={TableProperties}
          title={t.emptyTitle}
          description={t.emptyText}
          action={
            canEdit ? (
              <Button onClick={() => setApplying(true)}>
                <PackagePlus />
                {ar.specs.group.apply}
              </Button>
            ) : null
          }
        />
        <ApplyDialog group={group} open={applying} onOpenChange={setApplying} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-3">{t.hint}</p>
      <div className="overflow-auto rounded-xl border border-border bg-surface" style={{ maxHeight: "70vh" }}>
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 top-0 z-20 min-w-56 border-b border-e border-border bg-surface-2 px-3 py-2.5 text-start text-xs font-semibold text-ink-2">
                {t.product}
              </th>
              {labels.map((label) => (
                <th key={label} scope="col" className="sticky top-0 z-10 min-w-40 border-b border-border bg-surface-2 px-3 py-2.5 text-start text-xs font-semibold text-ink-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.product_id}>
                <th scope="row" className="sticky start-0 z-10 border-b border-e border-border bg-surface px-3 py-1.5 text-start font-medium">
                  <span className="flex items-center gap-2">
                    <Thumb src={row.image} size={28} />
                    <span className="max-w-48 truncate">{row.name}</span>
                  </span>
                </th>
                {labels.map((label, c) => {
                  const base = row.values[label] ?? null;
                  const edited = edits[row.product_id]?.[label];
                  const dirty = edited !== undefined;
                  return (
                    <td key={label} className="border-b border-border p-1">
                      <input
                        data-grid={group.id}
                        data-row={r}
                        data-col={c}
                        value={dirty ? edited : (base ?? "")}
                        onChange={(e) => setCell(row.product_id, label, e.target.value, base)}
                        onKeyDown={(e) => onKeyDown(e, r, c)}
                        maxLength={200}
                        dir="auto"
                        disabled={!canEdit}
                        aria-label={`${row.name}: ${label}`}
                        className={cn(
                          "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition-colors hover:border-border focus:border-primary focus:bg-surface disabled:opacity-70",
                          dirty && "border-accent/60 bg-accent-soft focus:bg-accent-soft",
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {meta && meta.last_page > 1 ? (
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
              {ar.specs.applyDialog.prev}
            </Button>
            <span className="tabular">{t.page(meta.current_page, meta.last_page)}</span>
            <Button variant="outline" size="sm" disabled={page >= meta.last_page} onClick={() => goTo(page + 1)}>
              {ar.specs.applyDialog.next}
            </Button>
          </div>
        ) : null}
        {canEdit ? (
          <div className="ms-auto flex items-center gap-2">
            {changed > 0 ? (
              <>
                <span className="text-[13px] text-ink-2">{t.changed(changed)}</span>
                <Button variant="ghost" onClick={() => setEdits({})} disabled={saving}>
                  {t.discard}
                </Button>
              </>
            ) : null}
            <Button onClick={() => void save()} loading={saving} disabled={changed === 0}>
              <Save />
              {t.save}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
