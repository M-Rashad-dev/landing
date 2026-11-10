"use client";

import { PlanLockedBadge } from "@/components/billing/plan";

import { useQueryClient } from "@tanstack/react-query";
import { Copy, History, MoreVertical, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, Pagination, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { PROMOTION_STATUS_OPTIONS, PromotionStatusBadge } from "@/components/dashboard/promotion-status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { formatPrice } from "@/lib/price";
import { codeKeys, deleteCode, toggleCode, useDiscountCodes } from "@/lib/promotions/api";
import type { DiscountCode } from "@/lib/types";
import { ar } from "@/messages/ar";
import { periodLabel } from "../offers/offers-manager";
import { CodeFormDialog } from "./code-form";
import { RedemptionsDialog } from "./redemptions-dialog";

const t = ar.codes;

export function codeValueLabel(code: DiscountCode): string {
  if (code.type === "percentage") return code.max_discount ? `${code.value}% (≤ ${formatPrice(code.max_discount)})` : `${code.value}%`;
  return formatPrice(code.value);
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t.copied);
  } catch {
    toast.error(ar.errors.generic);
  }
}

export function CodesManager() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search, 300);
  const { data, isPending, isError, error, refetch } = useDiscountCodes({ status, q: debounced, page });
  const [editing, setEditing] = useState<DiscountCode | null | "new">(null);
  const [deleting, setDeleting] = useState<DiscountCode | null>(null);
  const [history, setHistory] = useState<DiscountCode | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: codeKeys.all });

  async function onToggle(code: DiscountCode) {
    try {
      await toggleCode(code.id);
      toast.success(ar.promotions.toggled);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCode(deleting.id);
      toast.success(ar.promotions.deleted);
      setDeleting(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const menu = (code: DiscountCode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={ar.common.actions}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => setEditing(code)}>
          <Pencil />
          {ar.common.edit}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setHistory(code)}>
          <History />
          {t.redemptions}
        </DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={() => setDeleting(code)}>
          <Trash2 />
          {ar.common.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: Column<DiscountCode>[] = [
    {
      key: "code",
      header: t.columns.code,
      cell: (c) => (
        <div className="flex items-center gap-1">
          <span className="font-mono font-bold" dir="ltr">
            {c.code}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => copy(c.code)} aria-label={t.copy}>
            <Copy />
          </Button>
        </div>
      ),
    },
    { key: "value", header: t.columns.value, cell: (c) => <span className="whitespace-nowrap">{codeValueLabel(c)}</span> },
    { key: "period", header: t.columns.period, cell: (c) => <span className="text-xs text-muted-foreground">{periodLabel(c.starts_at, c.ends_at)}</span> },
    {
      key: "usage",
      header: t.columns.usage,
      cell: (c) => (
        <button type="button" className="tabular-nums hover:underline" dir="ltr" onClick={() => setHistory(c)}>
          {t.usage(c.used_count, c.usage_limit)}
        </button>
      ),
    },
    {
      key: "status",
      header: t.columns.status,
      cell: (c) => (
        <div className="flex items-center gap-2">
          <Switch checked={c.is_active} onCheckedChange={() => onToggle(c)} aria-label={t.fields.active} />
          <PromotionStatusBadge status={c.status} />
          <PlanLockedBadge locked={c.locked_by_plan} />
        </div>
      ),
    },
    { key: "actions", header: <span className="sr-only">{ar.common.actions}</span>, className: "w-12", cell: menu },
  ];

  const filtering = Boolean(status || debounced);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t.searchPlaceholder}
            className="ps-9"
            dir="ltr"
            aria-label={ar.common.search}
          />
        </div>
        <div className="sm:w-48">
          <Select
            aria-label={t.columns.status}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={PROMOTION_STATUS_OPTIONS}
          />
        </div>
        <Button className="sm:ms-auto" onClick={() => setEditing("new")}>
          <Plus />
          {t.new}
        </Button>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && data?.data.length === 0 && !filtering ? (
        <EmptyState icon={Tag} title={t.emptyTitle} description={t.emptyText} action={<Button onClick={() => setEditing("new")}>{t.new}</Button>} />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable columns={columns} rows={data?.data} rowKey={(c) => c.id} loading={isPending} />
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {data?.data.map((code) => (
              <li key={code.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="font-mono text-lg font-bold" dir="ltr" onClick={() => copy(code.code)}>
                    {code.code}
                  </button>
                  <PromotionStatusBadge status={code.status} />
                  <PlanLockedBadge locked={code.locked_by_plan} />
                </div>
                <p className="mt-1 text-sm">{codeValueLabel(code)}</p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                  {t.usage(code.used_count, code.usage_limit)}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <Switch checked={code.is_active} onCheckedChange={() => onToggle(code)} aria-label={t.fields.active} />
                  {menu(code)}
                </div>
              </li>
            ))}
          </ul>
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}

      <CodeFormDialog
        code={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refresh();
        }}
      />
      <RedemptionsDialog code={history} onClose={() => setHistory(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={ar.promotions.deleteTitle}
        description={ar.promotions.deleteText}
        confirmLabel={ar.common.delete}
        destructive
        loading={busy}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
