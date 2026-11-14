"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, MoreVertical, Search, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { InputGroup } from "@/components/ui/input";
import { Menu, MenuContent, MenuTrigger } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export type SortState = { key: string; dir: "asc" | "desc" } | null;

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "start" | "end" | "center";
  className?: string;
  /** Not shown on the mobile card. */
  hideOnMobile?: boolean;
};

/**
 * The list of every list screen: sortable headers, row selection with bulk actions, a row
 * menu, click to open, loading rows, empty state. Under `md` every row becomes a card.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  sort,
  onSortChange,
  selectable = false,
  selected = [],
  onSelectedChange,
  bulkActions,
  rowActions,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  empty?: React.ReactNode;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  selectable?: boolean;
  selected?: Array<string | number>;
  onSelectedChange?: (keys: Array<string | number>) => void;
  bulkActions?: React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const list = rows ?? [];
  const keys = list.map(rowKey);
  const allChecked = keys.length > 0 && keys.every((k) => selected.includes(k));
  const someChecked = !allChecked && keys.some((k) => selected.includes(k));
  const align = (a?: Column<T>["align"]) => (a === "end" ? "text-end" : a === "center" ? "text-center" : "text-start");

  function toggleSort(key: string) {
    if (!onSortChange) return;
    if (sort?.key !== key) onSortChange({ key, dir: "asc" });
    else if (sort.dir === "asc") onSortChange({ key, dir: "desc" });
    else onSortChange(null);
  }

  function toggleRow(key: string | number) {
    onSelectedChange?.(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  const showEmpty = !loading && list.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {selectable && selected.length > 0 ? (
        <div className="flex items-center gap-3 border-b border-border bg-brand-soft/60 px-4 py-2 text-sm">
          <span className="font-semibold">{ar.common.rowsSelected(selected.length)}</span>
          <div className="ms-auto flex items-center gap-2">{bulkActions}</div>
          <Button variant="ghost" size="icon-sm" onClick={() => onSelectedChange?.([])} aria-label={ar.common.cancel}>
            <X />
          </Button>
        </div>
      ) : null}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-xs text-ink-3">
              {selectable ? (
                <th className="w-10 px-4 py-2.5">
                  <Checkbox checked={allChecked ? true : someChecked ? "indeterminate" : false} onCheckedChange={() => onSelectedChange?.(allChecked ? [] : keys)} aria-label={ar.common.all} />
                </th>
              ) : null}
              {columns.map((col) => (
                <th key={col.key} className={cn("px-4 py-2.5 font-semibold", align(col.align), col.className)} aria-sort={sort?.key === col.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {col.sortable && onSortChange ? (
                    <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-ink">
                      {col.header}
                      {sort?.key === col.key ? sort.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-50" />}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {rowActions ? <th className="w-12" /> : null}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {selectable ? <td className="px-4 py-3" /> : null}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                    {rowActions ? <td /> : null}
                  </tr>
                ))
              : list.map((row) => {
                  const key = rowKey(row);
                  const isSelected = selected.includes(key);
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn("h-12 border-b border-border transition-colors last:border-0", onRowClick && "cursor-pointer hover:bg-surface-2/60", isSelected && "bg-brand-soft/40")}
                    >
                      {selectable ? (
                        <td className="px-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(key)} aria-label={String(key)} />
                        </td>
                      ) : null}
                      {columns.map((col) => (
                        <td key={col.key} className={cn("px-4 py-2", align(col.align), col.className)}>
                          {col.cell(row)}
                        </td>
                      ))}
                      {rowActions ? (
                        <td className="px-2" onClick={(e) => e.stopPropagation()}>
                          <RowMenu>{rowActions(row)}</RowMenu>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-border md:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))
          : list.map((row) => {
              const key = rowKey(row);
              const [first, ...rest] = columns.filter((c) => !c.hideOnMobile);
              return (
                <li key={key} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn("flex gap-3 p-4", onRowClick && "cursor-pointer active:bg-surface-2")}>
                  {selectable ? (
                    <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                      <Checkbox checked={selected.includes(key)} onCheckedChange={() => toggleRow(key)} aria-label={String(key)} />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {first ? <div className="mb-2">{first.cell(row)}</div> : null}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                      {rest.map((col) => (
                        <div key={col.key} className="min-w-0">
                          <dt className="text-[11px] text-ink-3">{col.header}</dt>
                          <dd className="truncate">{col.cell(row)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  {rowActions ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <RowMenu>{rowActions(row)}</RowMenu>
                    </span>
                  ) : null}
                </li>
              );
            })}
      </ul>

      {showEmpty ? empty ?? <EmptyState title={ar.common.noResults} compact /> : null}
    </div>
  );
}

function RowMenu({ children }: { children: React.ReactNode }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={ar.common.actions}>
          <MoreVertical />
        </Button>
      </MenuTrigger>
      <MenuContent>{children}</MenuContent>
    </Menu>
  );
}

export function Pagination({ page, lastPage, total, onPageChange }: { page: number; lastPage: number; total?: number; onPageChange: (page: number) => void }) {
  if (lastPage <= 1) return null;
  return (
    <nav className="mt-3 flex items-center justify-between gap-3 text-[13px] text-ink-3" aria-label={ar.common.page(page, lastPage)}>
      <span className="tabular">
        {ar.common.page(page, lastPage)}
        {total !== undefined ? ` · ${total}` : ""}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronRight />
          {ar.common.previous}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          {ar.common.next}
          <ChevronLeft />
        </Button>
      </div>
    </nav>
  );
}

/** Search + filters above a table, with the active filters as removable chips. */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  chips = [],
  onClear,
  actions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: React.ReactNode;
  chips?: Array<{ key: string; label: string; onRemove: () => void }>;
  onClear?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup start={<Search />} value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} aria-label={ar.common.search} className="w-full sm:w-72" />
        {filters}
        {actions ? <div className="ms-auto flex items-center gap-2">{actions}</div> : null}
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface ps-2.5 pe-1 text-xs">
              {chip.label}
              <button type="button" onClick={chip.onRemove} className="rounded p-0.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`${ar.common.delete} ${chip.label}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
          {onClear ? (
            <Button variant="link" size="sm" className="text-xs" onClick={onClear}>
              {ar.common.clearFilters}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
