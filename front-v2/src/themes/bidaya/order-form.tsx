"use client";

import { Banknote, Check, ImageOff, Loader2, Lock, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { GOVERNORATES } from "@/lib/store/governorates";
import { offerLabel, offerQuantity } from "@/lib/store/offers";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { QuantityStepper } from "@/themes/asas/parts";
import { imageSrc, usePage, useProductImages } from "./context";
import { usePrice } from "./sections";
import type { FormFieldKey, OrderFormProps } from "./types";
import { PLACED_KEY, useLandingOrder, type Placed } from "./use-order";

const t = ar.bidaya.form;
const c = ar.storefront.checkout;

const LABELS: Record<FormFieldKey, string> = { name: c.name, phone: c.phone, phone2: t.phone2, email: c.email, governorate: c.governorate, city: c.city, address: c.address, notes: c.notes };

/** The order form: product choices, offer cards, the visitor's data, the price and the order button. */
export function OrderForm({ props }: { props: OrderFormProps }) {
  const { data, mode } = usePage();
  const router = useRouter();
  const product = data.product;
  const image = imageSrc(useProductImages()[0] ?? null, "thumb");
  const price = usePrice();

  const placed = React.useCallback(
    (order: Placed) => {
      try {
        window.sessionStorage.setItem(PLACED_KEY, JSON.stringify(order));
      } catch {
        // Storage blocked: «طلبك وصل» shows the number from the address.
      }
      router.push(`/${encodeURIComponent(order.slug)}/done?order=${order.number}`);
    },
    [router],
  );
  const form = useLandingOrder(props, data, mode, placed);
  const q = form.quote;

  return (
    <section id="order" className="scroll-mt-4 px-4 py-10">
      <div className="bd-card mx-auto flex max-w-xl flex-col gap-5 p-5 shadow-sm @3xl:p-7">
        <div className="text-center">
          <h2 className="as-2xl font-extrabold">{props.title}</h2>
          {props.subtitle ? <p className="as-sm as-muted mt-1">{props.subtitle}</p> : null}
        </div>

        {product ? (
          <div className="flex items-center gap-3 rounded-xl bg-(--as-bg) p-2.5">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
              <img src={image} alt="" className="size-14 rounded-lg object-cover" />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-lg bg-(--as-soft) as-muted">
                <ImageOff className="size-5" aria-hidden />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="as-base truncate font-bold">{product.name}</span>
              {price ? (
                <span className="as-sm flex items-baseline gap-2">
                  <b className="as-primary">{formatMoney(price.now)}</b>
                  {price.was ? <span className="as-muted line-through">{formatMoney(price.was)}</span> : null}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}

        {form.unavailable && mode === "live" ? <p className="as-sm rounded-lg bg-red-50 p-3 font-semibold text-red-700">{t.unavailable}</p> : null}

        {(product?.options ?? []).map((option) => (
          <fieldset key={option.id} className="flex flex-col gap-2" data-field={`options.${option.id}`} tabIndex={-1}>
            <legend className="as-sm mb-1 font-bold">{option.name}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
              {option.values.map((v) => {
                const selected = form.options[option.id] === v.id;
                const swatch = option.display_type === "swatch" && v.color_hex;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => form.setOption(option.id, v.id)}
                    title={v.label}
                    className={cn("as-sm flex items-center gap-2 rounded-lg border-2 font-semibold transition", swatch ? "p-1" : "px-4 py-2", selected ? "border-(--as-primary) bg-(--as-soft)" : "hover:border-(--as-primary)/50")}
                  >
                    {swatch ? <span className="size-8 rounded-md border" style={{ background: v.color_hex! }} aria-hidden /> : null}
                    <span className={swatch ? "sr-only" : undefined}>{v.label}</span>
                    {v.price_delta && !swatch ? <span className="as-xs as-muted">{`${v.price_delta > 0 ? "+" : "−"}${formatMoney(Math.abs(v.price_delta))}`}</span> : null}
                  </button>
                );
              })}
            </div>
            {form.errors[`options.${option.id}`] ? <p className="as-xs font-semibold text-red-600">{form.errors[`options.${option.id}`]}</p> : null}
          </fieldset>
        ))}

        {form.picker ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="as-sm mb-1 font-bold">{t.offers}</legend>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.offers}>
              {[0, ...form.offers.map((o) => o.id)].map((id) => {
                const offer = form.offers.find((o) => o.id === id);
                const selected = form.chosenOffer === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => form.chooseOffer(id)}
                    className={cn("flex items-center gap-3 rounded-xl border-2 p-3 text-start transition", selected ? "border-(--as-primary) bg-(--as-soft)" : "hover:border-(--as-primary)/50")}
                  >
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-(--as-primary) bg-(--as-primary) text-(--as-on-primary)" : "")} aria-hidden>
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="as-sm font-bold">{offer ? offer.name : t.noOffer}</span>
                      <span className="as-xs as-muted">{offer ? offerLabel(offer) : t.noOfferText}</span>
                    </span>
                    <span className="as-xs bd-chip shrink-0 bg-(--as-bg) px-2 py-0.5 font-bold">{t.offerPieces(offer ? offerQuantity(offer) : 1)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {props.show_quantity ? (
          <div className="flex items-center justify-between gap-3">
            <span className="as-sm font-bold">{t.quantity}</span>
            <QuantityStepper value={form.quantity} onChange={form.setQuantity} max={20} />
          </div>
        ) : null}

        <div className="grid gap-3 @md:grid-cols-2">
          {form.fields.map((key) => {
            const id = `bd-${key}`;
            const error = form.errors[`customer.${key}`];
            const wide = key === "address" || key === "notes";
            const common = {
              id,
              "data-field": `customer.${key}`,
              "aria-invalid": Boolean(error),
              className: "bd-field as-base",
              value: form.values[key] ?? "",
              onFocus: form.touch,
            };
            return (
              <div key={key} className={cn("flex flex-col gap-1.5", wide && "@md:col-span-2")}>
                <label htmlFor={id} className="as-sm font-bold">
                  {LABELS[key]}
                  {form.required(key) ? null : <span className="as-muted ms-1 font-normal">{c.optional}</span>}
                </label>
                {key === "governorate" ? (
                  <select {...common} onChange={(e) => form.setValue(key, e.target.value)}>
                    <option value="">{c.chooseGovernorate}</option>
                    {GOVERNORATES.map((g) => (
                      <option key={g} value={g} disabled={form.unavailableGovernorates.includes(g)}>
                        {g}
                      </option>
                    ))}
                  </select>
                ) : key === "notes" || key === "address" ? (
                  <textarea {...common} rows={2} autoComplete={key === "address" ? "street-address" : undefined} onChange={(e) => form.setValue(key, e.target.value)} />
                ) : (
                  <input
                    {...common}
                    type={key === "phone" || key === "phone2" ? "tel" : key === "email" ? "email" : "text"}
                    inputMode={key === "phone" || key === "phone2" ? "tel" : key === "email" ? "email" : "text"}
                    dir={key === "phone" || key === "phone2" || key === "email" ? "ltr" : undefined}
                    autoComplete={key === "name" ? "name" : key === "phone" ? "tel" : key === "email" ? "email" : undefined}
                    onChange={(e) => form.setValue(key, e.target.value)}
                  />
                )}
                {error ? <p className="as-xs font-semibold text-red-600">{error}</p> : null}
              </div>
            );
          })}
        </div>

        {q?.shipping_options && q.shipping_options.length > 1 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="as-sm mb-1 font-bold">{t.shipping}</legend>
            {q.shipping_options.map((option) => {
              const selected = (form.company ?? q.shipping_company?.id) === option.id;
              return (
                <button key={option.id} type="button" role="radio" aria-checked={selected} onClick={() => form.setCompany(option.id)} className={cn("as-sm flex items-center justify-between gap-2 rounded-lg border-2 p-3 text-start", selected ? "border-(--as-primary) bg-(--as-soft)" : "")}>
                  <span className="font-semibold">
                    {option.name}
                    <span className="as-xs as-muted ms-2 font-normal">{c.shippingDays(option.days_min, option.days_max)}</span>
                  </span>
                  <b>{option.fee === 0 ? t.free : formatMoney(option.fee)}</b>
                </button>
              );
            })}
          </fieldset>
        ) : null}

        <CodeBox form={form} />

        <Summary quote={q} loading={form.quoteLoading} />

        <p className="as-sm flex items-center gap-2 rounded-lg bg-(--as-soft) p-3 font-semibold">
          <Banknote className="size-5 as-primary" aria-hidden />
          {t.cod}
        </p>

        {form.formError ? (
          <p className="as-sm font-semibold text-red-600" role="alert">
            {form.formError}
          </p>
        ) : null}

        <button type="button" onClick={() => void form.submit()} disabled={form.submitting || (form.unavailable && mode === "live")} className="as-btn as-lg h-13 w-full disabled:cursor-not-allowed disabled:opacity-60">
          {form.submitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {form.submitting ? t.submitting : props.button_label}
          {q && !form.submitting ? <span className="opacity-90">· {formatMoney(q.total)}</span> : null}
        </button>
        <p className="as-xs as-muted flex items-center justify-center gap-1.5">
          <Lock className="size-3.5" aria-hidden />
          {t.secure}
        </p>
      </div>
    </section>
  );
}

function CodeBox({ form }: { form: ReturnType<typeof useLandingOrder> }) {
  const [open, setOpen] = React.useState(false);
  if (form.appliedCode && form.quote?.code) {
    return (
      <p className="as-sm flex items-center justify-between gap-2 rounded-lg bg-(--as-soft) p-2.5 font-semibold">
        <span className="flex items-center gap-1.5">
          <Tag className="size-4 as-primary" aria-hidden />
          {c.codeApplied(form.quote.code.code)}
        </span>
        <button type="button" onClick={form.removeCode} className="as-muted" aria-label={c.removeCode}>
          <X className="size-4" />
        </button>
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="as-sm w-fit font-semibold as-primary hover:underline">
        {c.codePlaceholder}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input aria-label={c.code} value={form.code} onChange={(e) => form.setCode(e.target.value)} dir="ltr" className="bd-field as-base flex-1 uppercase" aria-invalid={Boolean(form.errors.code)} />
        <button type="button" onClick={form.applyCode} className="as-btn as-sm px-4">
          {c.applyCode}
        </button>
      </div>
      {form.errors.code ? <p className="as-xs font-semibold text-red-600">{form.errors.code}</p> : null}
    </div>
  );
}

function Summary({ quote, loading }: { quote: ReturnType<typeof useLandingOrder>["quote"]; loading: boolean }) {
  if (!quote) return null;
  const shipping = quote.shipping;
  return (
    <dl className={cn("as-sm flex flex-col gap-1.5 border-t pt-3 transition-opacity", loading && "opacity-60")}>
      <Row label={`${t.items} × ${quote.quantity}`} value={formatMoney(quote.base_subtotal)} />
      {quote.offer ? <Row label={`${t.offerDiscount} (${quote.offer.name})`} value={`− ${formatMoney(quote.offer.discount)}`} accent /> : null}
      {quote.gift ? <Row label={t.gift(quote.gift.name)} value={t.free} accent /> : null}
      {quote.code ? <Row label={t.codeDiscount} value={`− ${formatMoney(quote.code.discount)}`} accent /> : null}
      <Row label={t.shippingFee} value={shipping === null || shipping === undefined ? t.shippingLater : shipping === 0 ? t.free : formatMoney(shipping)} />
      {quote.shipping_available === false ? <p className="as-xs font-semibold text-red-600">{t.noGovernorate}</p> : null}
      <div className="as-base mt-1 flex items-center justify-between border-t pt-2 font-extrabold">
        <dt>{t.total}</dt>
        <dd className="as-primary">{formatMoney(quote.total)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="as-muted">{label}</dt>
      <dd className={cn("font-semibold", accent && "text-green-700")}>{value}</dd>
    </div>
  );
}
