"use client";

import { CheckCircle2, Eye, Printer, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable, FilterBar, Pagination, type Column, type SortState } from "@/components/data/data-table";
import { EntityCell } from "@/components/data/details";
import { ORDER_STATUSES, OrderStatusBadge } from "@/components/domain/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/feedback";
import { MenuItem, MenuSeparator } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/tabs";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { DEMO_GOVERNORATES, DEMO_ORDERS, type DemoOrder } from "../fixtures";
import { ShowSection } from "../frame";
import { OrderDrawer } from "./order-drawer";

const t = ar.showcase.table;
const PER_PAGE = 8;

/** Orders-style list: everything (search, filters, sort, page) lives in the URL. */
export function TableSection() {
  const [state, setState] = useUrlState(["q", "status", "gov", "sort", "page"] as const);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [demo, setDemo] = useState<"data" | "loading" | "empty">("data");
  const [open, setOpen] = useState<DemoOrder | null>(null);

  const sort: SortState = useMemo(() => (state.sort ? { key: state.sort.replace(/^-/, ""), dir: state.sort.startsWith("-") ? "desc" : "asc" } : null), [state.sort]);

  const filtered = useMemo(() => {
    const q = state.q.trim();
    let rows = DEMO_ORDERS.filter((o) => (!q || o.customer.includes(q) || o.phone.includes(q) || String(o.number).includes(q)) && (!state.status || o.status === state.status) && (!state.gov || o.governorate === state.gov));
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = a[sort.key as keyof DemoOrder];
        const bv = b[sort.key as keyof DemoOrder];
        return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
      });
    }
    return rows;
  }, [state.q, state.status, state.gov, sort]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(lastPage, Math.max(1, Number(state.page) || 1));
  const rows = demo === "empty" ? [] : filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const columns: Column<DemoOrder>[] = [
    { key: "number", header: t.columns.number, sortable: true, cell: (o) => <span className="tabular font-semibold">#{o.number}</span> },
    { key: "customer", header: t.columns.customer, cell: (o) => <EntityCell avatar={o.customer} title={o.customer} subtitle={<span dir="ltr" className="tabular">{o.phone}</span>} /> },
    {
      key: "product",
      header: t.columns.product,
      hideOnMobile: true,
      cell: (o) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate">{o.product}</span>
          {o.extra ? <span className="tabular text-xs text-ink-3">{t.moreItems(o.extra)}</span> : null}
          {o.source === "store" ? <Badge tone="info" size="sm">{ar.domain.source.store}</Badge> : null}
        </span>
      ),
    },
    { key: "governorate", header: t.columns.governorate, cell: (o) => o.governorate },
    { key: "total", header: t.columns.total, sortable: true, align: "end", cell: (o) => <span className="tabular font-semibold">{formatMoney(o.total)}</span> },
    { key: "status", header: t.columns.status, cell: (o) => <OrderStatusBadge status={o.status} /> },
    { key: "createdAt", header: t.columns.date, sortable: true, cell: (o) => <span className="tabular text-xs text-ink-3">{formatDateTime(o.createdAt)}</span> },
  ];

  const chips = [
    ...(state.status ? [{ key: "status", label: ar.domain.orderStatus[state.status as keyof typeof ar.domain.orderStatus] ?? state.status, onRemove: () => setState({ status: null }) }] : []),
    ...(state.gov ? [{ key: "gov", label: state.gov, onRemove: () => setState({ gov: null }) }] : []),
  ];

  return (
    <ShowSection id="table" title={ar.showcase.sections.table.title} description={ar.showcase.sections.table.description}>
      <Segmented
        value={demo}
        onChange={setDemo}
        options={[
          { value: "data", label: ar.showcase.sections.table.title },
          { value: "loading", label: t.loadingDemo },
          { value: "empty", label: t.emptyDemo },
        ]}
        className="self-start"
      />
      <div>
        <FilterBar
          search={state.q}
          onSearchChange={(q) => setState({ q })}
          searchPlaceholder={t.search}
          filters={
            <>
              <Select aria-label={t.statusFilter} emptyLabel={t.statusFilter} value={state.status} onValueChange={(status) => setState({ status })} options={ORDER_STATUSES.map((s) => ({ value: s, label: ar.domain.orderStatus[s] }))} className="w-40" />
              <Select aria-label={t.governorateFilter} emptyLabel={t.governorateFilter} value={state.gov} onValueChange={(gov) => setState({ gov })} options={DEMO_GOVERNORATES.map((g) => ({ value: g, label: g }))} searchable searchPlaceholder={t.governorateSearch} className="w-44" />
            </>
          }
          chips={chips}
          onClear={chips.length || state.q ? () => setState({ q: null, status: null, gov: null }) : undefined}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(o) => o.id}
          loading={demo === "loading"}
          sort={sort}
          onSortChange={(s) => setState({ sort: s ? `${s.dir === "desc" ? "-" : ""}${s.key}` : null })}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={
            <Button size="sm" variant="outline">
              <CheckCircle2 />
              {t.bulkConfirm}
            </Button>
          }
          onRowClick={setOpen}
          rowActions={() => (
            <>
              <MenuItem>
                <Eye />
                {t.view}
              </MenuItem>
              <MenuItem>
                <CheckCircle2 />
                {t.confirm}
              </MenuItem>
              <MenuItem>
                <Printer />
                {t.print}
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive>
                <XCircle />
                {t.cancel}
              </MenuItem>
            </>
          )}
          empty={<EmptyState title={t.emptyTitle} description={t.emptyText} compact />}
        />
        {demo === "data" ? <Pagination page={page} lastPage={lastPage} total={filtered.length} onPageChange={(p) => setState({ page: String(p) })} /> : null}
      </div>
      <OrderDrawer order={open} onClose={() => setOpen(null)} />
    </ShowSection>
  );
}
