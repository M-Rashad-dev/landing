"use client";

import { Alert } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { OrderDetail } from "./api";

const t = ar.profit.order;

/** What the order cost and earns, from the costs snapshotted when it was placed (only sent with «الأرباح: عرض»). */
export function ProfitCard({ order }: { order: OrderDetail }) {
  const p = order.profit;
  if (!p) return null;
  const rows = [
    { label: t.revenue, value: p.revenue },
    { label: t.productCost, value: -p.product_cost },
    { label: t.shipping, value: -p.shipping_cost },
    { label: t.cod, value: -p.cod_fee },
    { label: t.packaging, value: -p.packaging },
  ].filter((r) => r.value !== 0);
  return (
    <Panel>
      <PanelHeader title={t.title} description={t.hint} />
      <PanelBody className="flex flex-col gap-3">
        <dl className="flex flex-col gap-1.5 text-[13px]">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between">
              <dt className="text-ink-2">{r.label}</dt>
              <dd className="tabular">{r.value < 0 ? `− ${formatMoney(-r.value)}` : formatMoney(r.value)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
            <dt>{p.loss ? t.loss : t.profit}</dt>
            <dd className={cn("tabular", p.profit < 0 && "text-danger")}>{formatMoney(p.profit)}</dd>
          </div>
        </dl>
        {p.cost_known ? null : <Alert tone="warning">{t.noCost}</Alert>}
      </PanelBody>
    </Panel>
  );
}
