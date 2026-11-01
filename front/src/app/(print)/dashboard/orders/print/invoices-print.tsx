"use client";

import { useQueries } from "@tanstack/react-query";
import { ArrowRight, FileText, Printer, Tag } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/dashboard/brand-mark";
import { ErrorState } from "@/components/dashboard/error-state";
import { Button } from "@/components/ui/button";
import { formatCairo } from "@/lib/dates";
import { formatPhoneLocal } from "@/lib/format/phone";
import { fetchOrder, orderKeys, type OrderDetail } from "@/lib/orders/api";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.orders.invoice;
type Size = "a4" | "a6";

/** One invoice per printed page; A4 invoice or A6 shipping label. */
export function InvoicesPrint({ ids, initialSize }: { ids: number[]; initialSize: Size }) {
  const [size, setSize] = useState<Size>(initialSize);
  const results = useQueries({ queries: ids.map((id) => ({ queryKey: orderKeys.detail(id), queryFn: ({ signal }: { signal: AbortSignal }) => fetchOrder(id, signal) })) });
  const loading = results.some((r) => r.isPending);
  const failed = results.find((r) => r.isError);
  const orders = results.map((r) => r.data).filter((o): o is OrderDetail => Boolean(o));

  return (
    <div className="min-h-dvh bg-muted/50 print:bg-white">
      {/* Page size for the printer. */}
      <style>{`@page { size: ${size === "a4" ? "A4" : "A6"}; margin: ${size === "a4" ? "12mm" : "5mm"}; }`}</style>

      <header className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ids.length === 1 ? `/dashboard/orders/${ids[0]}` : "/dashboard/orders"}>
            <ArrowRight />
            {ar.common.back}
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">{t.count(orders.length)}</span>
        <div className="ms-auto flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/50 p-0.5" role="radiogroup" aria-label={t.title}>
            {(["a4", "a6"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={size === option}
                onClick={() => setSize(option)}
                className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", size === option ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground")}
              >
                {option === "a4" ? <FileText className="size-3.5" /> : <Tag className="size-3.5" />}
                {option === "a4" ? t.sizeA4 : t.sizeA6}
              </button>
            ))}
          </div>
          <Button onClick={() => window.print()} disabled={loading || orders.length === 0}>
            <Printer />
            {t.printNow}
          </Button>
        </div>
      </header>

      {failed ? (
        <div className="mx-auto max-w-lg p-6">
          <ErrorState error={failed.error} onRetry={() => failed.refetch()} />
        </div>
      ) : ids.length === 0 ? (
        <p className="p-10 text-center text-muted-foreground">{t.empty}</p>
      ) : loading ? (
        <p className="p-10 text-center text-muted-foreground">{t.loading}</p>
      ) : (
        <div className="flex flex-col items-center gap-6 py-6 print:block print:p-0">
          {orders.map((order) => (size === "a4" ? <Invoice key={order.id} order={order} /> : <Label key={order.id} order={order} />))}
        </div>
      )}
    </div>
  );
}

function Barcode({ value, height = 44 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let cancelled = false;
    void import("jsbarcode").then(({ default: JsBarcode }) => {
      if (!cancelled && ref.current) JsBarcode(ref.current, value, { format: "CODE128", height, width: 1.6, margin: 0, displayValue: false, background: "transparent" });
    });
    return () => {
      cancelled = true;
    };
  }, [value, height]);
  return <svg ref={ref} aria-label={value} role="img" />;
}

function Address({ order }: { order: OrderDetail }) {
  return (
    <>
      <p className="font-semibold">{order.customer_name}</p>
      <p className="tabular-nums">
        <bdi dir="ltr">{formatPhoneLocal(order.customer_phone)}</bdi>
        {order.customer_phone2 ? (
          <>
            {" · "}
            <bdi dir="ltr">{formatPhoneLocal(order.customer_phone2)}</bdi>
          </>
        ) : null}
      </p>
      <p>{[order.governorate, order.city].filter(Boolean).join(" — ")}</p>
      {order.address ? <p className="whitespace-pre-line">{order.address}</p> : null}
    </>
  );
}

function Invoice({ order }: { order: OrderDetail }) {
  const { brand } = order;
  return (
    <article className="w-[210mm] max-w-full break-after-page last:break-after-auto bg-white p-10 text-[13px] leading-relaxed text-[#16182b] shadow-md print:w-auto print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#16182b] pb-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- printed logo from the media volume */}
          {brand.logo ? <img src={brand.logo} alt="" className="h-14 w-auto max-w-40 object-contain" /> : <BrandMark className="size-12" />}
          <div>
            <p className="font-display text-xl font-semibold">{brand.name}</p>
            <p className="text-xs text-[#6a6759]">{[brand.phone && formatPhoneLocal(brand.phone), brand.email, brand.address].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="text-end">
          <p className="font-display text-2xl font-semibold">{t.title}</p>
          <p className="text-xs text-[#6a6759]">
            {t.number}: <span className="font-semibold text-[#16182b] tabular-nums">#{order.order_number}</span>
          </p>
          <p className="text-xs text-[#6a6759]">
            {t.date}: {formatCairo(order.created_at, { withTime: false })}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-[1fr_auto] items-end gap-6 py-5">
        <div>
          <p className="mb-1 text-xs font-semibold text-[#6a6759]">{t.billTo}</p>
          <Address order={order} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Barcode value={String(order.order_number)} />
          <span className="text-xs tabular-nums">#{order.order_number}</span>
        </div>
      </section>

      <table className="w-full border-collapse text-start">
        <thead>
          <tr className="border-y border-[#16182b] text-xs">
            <th className="py-2 text-start font-semibold">{t.product}</th>
            <th className="w-20 py-2 text-center font-semibold">{t.quantity}</th>
            <th className="w-28 py-2 text-end font-semibold">{t.unitPrice}</th>
            <th className="w-28 py-2 text-end font-semibold">{t.lineTotal}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-[#e5e0d4]">
              <td className="py-3">
                <p className="font-semibold">
                  {item.product_name}
                  {item.is_gift ? ` (${ar.orders.giftItem})` : ""}
                </p>
                {item.options.length ? <p className="text-xs text-[#6a6759]">{item.options.map((o) => `${o.option}: ${o.value}`).join(" · ")}</p> : null}
              </td>
              <td className="py-3 text-center tabular-nums">{item.quantity}</td>
              <td className="py-3 text-end tabular-nums">{formatPrice(item.unit_price)}</td>
              <td className="py-3 text-end font-semibold tabular-nums">{formatPrice(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-5 flex justify-between gap-8">
        <div className="max-w-sm text-xs">
          {order.notes ? (
            <>
              <p className="font-semibold text-[#6a6759]">{t.notes}</p>
              <p className="whitespace-pre-line">{order.notes}</p>
            </>
          ) : null}
        </div>
        <dl className="w-72 text-sm">
          <Row label={t.subtotal} value={formatPrice(order.subtotal)} />
          {order.offer ? <Row label={t.offer(order.offer.name)} value={`− ${formatPrice(order.offer.discount)}`} /> : null}
          {order.code ? <Row label={t.code(order.code.code)} value={`− ${formatPrice(order.code.discount)}`} /> : null}
          {order.shipping_fee > 0 ? <Row label={t.shipping} value={formatPrice(order.shipping_fee)} /> : null}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-[#16182b] px-4 py-3 text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
            <dt className="text-xs">{t.collect}</dt>
            <dd className="font-display text-xl font-semibold tabular-nums">{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-10 border-t border-[#e5e0d4] pt-4 text-center text-xs text-[#6a6759]">
        {t.thanks} · {t.cod}
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#e5e0d4] py-1.5">
      <dt className="text-[#6a6759]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** A6 shipping label: who to deliver to, what's inside, how much to collect. */
function Label({ order }: { order: OrderDetail }) {
  return (
    <article className="flex w-[105mm] break-after-page last:break-after-auto flex-col gap-3 bg-white p-5 text-[12px] leading-snug text-[#16182b] shadow-md print:w-auto print:p-0 print:shadow-none">
      <header className="flex items-center justify-between border-b-2 border-[#16182b] pb-2">
        <p className="font-display text-base font-semibold">{order.brand.name}</p>
        <p className="font-display text-lg font-semibold tabular-nums">#{order.order_number}</p>
      </header>
      <div className="flex justify-center">
        <Barcode value={String(order.order_number)} height={40} />
      </div>
      <div className="text-[13px]">
        <Address order={order} />
      </div>
      <ul className="border-y border-[#e5e0d4] py-2">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity} × {item.product_name}
            {item.options.length ? ` (${item.options.map((o) => o.value).join("، ")})` : ""}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between rounded-md bg-[#16182b] px-3 py-2 text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <span className="text-[11px]">{t.collect}</span>
        <span className="font-display text-lg font-semibold tabular-nums">{formatPrice(order.total)}</span>
      </div>
      {order.notes ? <p className="text-[11px]">{order.notes}</p> : null}
    </article>
  );
}
