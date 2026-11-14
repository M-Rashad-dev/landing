"use client";

import { Printer } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { ar } from "@/messages/ar";
import { useOrder } from "./api";

const t = ar.orders.invoice;
const d = ar.orders.detail;

/** A4 invoice for one order, printed from the browser (the seller is the page's identity or the store). */
export function InvoiceView({ id }: { id: number }) {
  const query = useOrder(id);

  if (query.isPending) return <Skeleton className="mx-auto h-[40rem] max-w-3xl rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const o = query.data;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer />
          {t.print}
        </Button>
      </div>
      <article className="rounded-xl border border-border bg-white p-8 text-black print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-black/10 pb-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- printed logo */}
            {o.brand.logo ? <img src={o.brand.logo} alt="" className="h-14 w-auto" /> : null}
            <div>
              <p className="text-lg font-bold">{o.brand.name}</p>
              <p className="text-xs text-black/60" dir="ltr">
                {[o.brand.phone, o.brand.email].filter(Boolean).join(" · ")}
              </p>
              {o.brand.address ? <p className="text-xs text-black/60">{o.brand.address}</p> : null}
            </div>
          </div>
          <div className="text-end">
            <p className="text-2xl font-bold">{t.title}</p>
            <p className="text-sm tabular">
              {t.number}: #{o.order_number}
            </p>
            <p className="text-sm tabular">
              {t.date}: {formatDateTime(o.created_at)}
            </p>
          </div>
        </header>

        <section className="py-5 text-sm">
          <p className="mb-1 text-xs font-semibold text-black/60">{t.billTo}</p>
          <p className="font-semibold">{o.customer_name}</p>
          <p dir="ltr" className="text-end sm:text-start">
            {formatPhone(o.customer_phone)}
          </p>
          <p>{[o.governorate, o.city, o.address].filter(Boolean).join("، ")}</p>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-black/10 text-xs text-black/60">
              <th className="py-2 text-start font-medium">{t.product}</th>
              <th className="py-2 text-center font-medium">{t.qty}</th>
              <th className="py-2 text-end font-medium">{t.price}</th>
              <th className="py-2 text-end font-medium">{t.lineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((item) => (
              <tr key={item.id} className="border-b border-black/5">
                <td className="py-2">
                  {item.product_name}
                  {item.is_gift ? ` (${d.gift})` : ""}
                  {item.options.length ? <span className="block text-xs text-black/60">{item.options.map((x) => `${x.option}: ${x.value}`).join(" · ")}</span> : null}
                </td>
                <td className="py-2 text-center tabular">{item.quantity}</td>
                <td className="py-2 text-end tabular">{formatMoney(item.unit_price)}</td>
                <td className="py-2 text-end tabular">{formatMoney(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ms-auto mt-4 flex max-w-xs flex-col gap-1 text-sm">
          <Row label={d.subtotal} value={formatMoney(o.subtotal)} />
          {o.offer ? <Row label={d.offer(o.offer.name)} value={o.offer.discount > 0 ? `− ${formatMoney(o.offer.discount)}` : d.gift} /> : null}
          {o.code ? <Row label={d.code(o.code.code)} value={`− ${formatMoney(o.code.discount)}`} /> : null}
          <Row label={d.shipping} value={o.shipping_fee === 0 && o.shipping.discount > 0 ? d.shippingFree : formatMoney(o.shipping_fee)} />
          <div className="mt-1 flex justify-between border-t border-black/20 pt-2 text-base font-bold">
            <dt>{d.total}</dt>
            <dd className="tabular">{formatMoney(o.total)}</dd>
          </div>
          <p className="text-xs text-black/60">{d.cod}</p>
        </dl>

        <p className="mt-10 text-center text-sm text-black/60">{t.thanks}</p>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-black/70">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
