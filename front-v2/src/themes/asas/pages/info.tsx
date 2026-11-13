"use client";

import { CircleCheck, PauseCircle, SearchX } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { UpsellOffer } from "../../upsell-offer";
import { StoreLink } from "../context";
import { Breadcrumb, Container } from "../parts";

const t = ar.storefront;

/** After the order: its number, what happens next, and the way to track it. */
export function OrderDone({ orderNumber, total: initialTotal }: { orderNumber: number | null; total: number | null }) {
  const [total, setTotal] = React.useState(initialTotal);
  return (
    <Container className="flex justify-center py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border p-6 text-center @3xl:p-8">
        <span className="flex size-16 items-center justify-center rounded-full bg-(--as-soft) as-primary">
          <CircleCheck className="size-9" aria-hidden />
        </span>
        <h1 className="as-2xl font-extrabold">{t.done.title}</h1>
        {orderNumber ? <p className="as-lg font-bold as-primary">{t.done.number(orderNumber)}</p> : null}
        <p className="as-sm as-muted">{t.done.text}</p>
        {total !== null ? (
          <p className="as-sm flex w-full justify-between rounded-lg bg-(--as-card) px-4 py-3">
            <span className="as-muted">{t.done.total}</span>
            <b>{formatMoney(total)}</b>
          </p>
        ) : null}
        <UpsellOffer orderNumber={orderNumber} onTotal={setTotal} />
        <div className="flex w-full flex-col gap-2">
          <StoreLink href={orderNumber ? `/track?order=${orderNumber}` : "/track"} className="as-btn as-base w-full">
            {t.done.track}
          </StoreLink>
          <StoreLink href="/products" className="as-sm py-2 font-semibold as-primary hover:underline">
            {t.done.shop}
          </StoreLink>
        </div>
      </div>
    </Container>
  );
}

/** A store page (policies, about…) written in Markdown by the merchant. */
export function StaticPageView({ title, body }: { title: string; body: string | null }) {
  return (
    <Container className="flex max-w-3xl flex-col gap-5 py-6 @3xl:py-10">
      <Breadcrumb items={[{ name: title }]} />
      <h1 className="as-2xl font-extrabold">{title}</h1>
      {body ? (
        <div className="as-prose as-base">
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
      ) : null}
    </Container>
  );
}

export function StoreNotFound() {
  return (
    <Container className="flex flex-col items-center gap-3 py-20 text-center">
      <SearchX className="size-12 as-muted" aria-hidden />
      <h1 className="as-2xl font-extrabold">{t.notFound.title}</h1>
      <p className="as-sm as-muted">{t.notFound.text}</p>
      <StoreLink href="/" className="as-btn as-sm mt-2">
        {t.notFound.home}
      </StoreLink>
    </Container>
  );
}

/** A store whose subscription is paused or unpaid: no store name, no products, only this. */
export function StorePaused() {
  return (
    <div dir="rtl" lang="ar" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white p-6 text-center text-neutral-800">
      <PauseCircle className="size-12 text-neutral-400" aria-hidden />
      <h1 className="text-2xl font-extrabold">{t.paused.title}</h1>
      <p className="text-sm text-neutral-500">{t.paused.text}</p>
    </div>
  );
}
