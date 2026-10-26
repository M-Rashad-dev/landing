"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format/number";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

export type PageMeta = { current_page: number; last_page: number; total: number; per_page: number };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  onRowClick,
  className,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <TableRow key={i}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows?.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!loading && rows && rows.length === 0 ? <div className="p-6">{empty ?? <p className="text-center text-sm text-muted-foreground">{ar.common.noResults}</p>}</div> : null}
    </div>
  );
}

export function Pagination({ meta, onPageChange }: { meta: PageMeta | undefined; onPageChange: (page: number) => void }) {
  if (!meta || meta.last_page <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label={ar.common.page}>
      <span className="text-muted-foreground">
        {ar.common.page} {formatNumber(meta.current_page)} {ar.common.of} {formatNumber(meta.last_page)} · {ar.common.total} {formatNumber(meta.total)}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={meta.current_page <= 1} onClick={() => onPageChange(meta.current_page - 1)}>
          <ChevronRight />
          {ar.common.previous}
        </Button>
        <Button variant="outline" size="sm" disabled={meta.current_page >= meta.last_page} onClick={() => onPageChange(meta.current_page + 1)}>
          {ar.common.next}
          <ChevronLeft />
        </Button>
      </div>
    </nav>
  );
}
