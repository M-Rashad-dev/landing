"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, Pagination, type Column } from "@/components/dashboard/data-table";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatPhoneLocal } from "@/lib/format/phone";
import { addBlocked, removeBlocked, useBlockedCustomers, type BlockedCustomer } from "@/lib/orders/api";
import { ar } from "@/messages/ar";

const t = ar.orders.blockedPage;

export function BlockedManager() {
  const queryClient = useQueryClient();
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useBlockedCustomers({ type, page });
  const [form, setForm] = useState<{ type: "phone" | "ip"; value: string; reason: string }>({ type: "phone", value: "", reason: "" });
  const [formError, setFormError] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<BlockedCustomer | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["blocked-customers"] });

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setAdding(true);
    setFormError(undefined);
    try {
      await addBlocked({ type: form.type, value: form.value, reason: form.reason.trim() || null });
      toast.success(t.added);
      setForm((f) => ({ ...f, value: "", reason: "" }));
      await refresh();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setFormError(err.errors.value?.[0] ?? err.message);
      else toast.error(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await removeBlocked(removing.id);
      toast.success(t.removed);
      setRemoving(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const label = (b: BlockedCustomer) => (b.type === "phone" ? formatPhoneLocal(b.value) : b.value);
  const columns: Column<BlockedCustomer>[] = [
    { key: "type", header: t.type, cell: (b) => <Badge variant={b.type === "phone" ? "default" : "secondary"}>{b.type === "phone" ? t.phone : t.ip}</Badge> },
    { key: "value", header: t.value, cell: (b) => <span dir="ltr" className="font-semibold tabular-nums">{label(b)}</span> },
    { key: "reason", header: t.reason, cell: (b) => <span className="text-sm text-muted-foreground">{b.reason ?? "—"}</span> },
    { key: "date", header: t.date, cell: (b) => <span className="text-xs text-muted-foreground">{formatCairo(b.created_at)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">{ar.common.actions}</span>,
      className: "w-12",
      cell: (b) => (
        <Button variant="ghost" size="icon-sm" aria-label={t.remove} onClick={() => setRemoving(b)}>
          <Trash2 />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/orders" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {ar.orders.back}
      </Link>

      <form onSubmit={add} className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[160px_1fr_1fr_auto] sm:items-end">
        <FormField label={t.type} htmlFor="b_type">
          <Select id="b_type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "phone" | "ip" }))} options={[{ value: "phone", label: t.phone }, { value: "ip", label: t.ip }]} />
        </FormField>
        <FormField label={t.value} htmlFor="b_value" error={formError} required>
          <Input id="b_value" dir="ltr" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder={form.type === "phone" ? "01xxxxxxxxx" : "41.10.10.10"} required />
        </FormField>
        <FormField label={t.reason} htmlFor="b_reason">
          <Input id="b_reason" value={form.reason} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </FormField>
        <Button type="submit" loading={adding} disabled={!form.value.trim()}>
          <Plus />
          {t.add}
        </Button>
      </form>

      <div className="sm:w-48">
        <Select
          aria-label={t.type}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          options={[{ value: "", label: ar.orders.all }, { value: "phone", label: t.phone }, { value: "ip", label: t.ip }]}
        />
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(b) => b.id}
            loading={isPending}
            empty={
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4" aria-hidden />
                {t.empty}
              </p>
            }
          />
          <Pagination meta={data?.meta} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? t.removeConfirm(label(removing)) : ""}
        confirmLabel={t.remove}
        loading={busy}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
