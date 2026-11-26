"use client";

import { Banknote, Check, Loader2, Lock, ShieldCheck, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { GOVERNORATES } from "@/lib/store/governorates";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { hasPaymentChoice, PaymentChoice } from "@/themes/shared/payment-choice";
import { TransferBox } from "@/themes/shared/receipt-upload";
import { CustomerInputFields } from "@/themes/shared/customer-inputs";
import { QuantityStepper } from "@/themes/store/asas/parts";
import { imageSrc, useImage, usePage, useProductImages } from "@/themes/landing/bidaya/context";
import { CodeBox, Summary } from "@/themes/landing/bidaya/order-form";
import type { FormFieldKey } from "@/themes/landing/bidaya/types";
import { PLACED_KEY, useLandingOrder, type Placed } from "@/themes/landing/bidaya/use-order";
import { dealOf, useOfferChoice } from "@/themes/landing/shared/offers";
import { Ornament } from "./sections";
import type { OrderFormProps } from "./types";

const f = ar.bidaya.form;
const c = ar.storefront.checkout;
const t = ar.sufiLanding;

const LABELS: Record<FormFieldKey, string> = { name: c.name, phone: c.phone, phone2: f.phone2, email: c.email, governorate: c.governorate, city: c.city, address: c.address, notes: c.notes };

/** The order form: the product card beside it, the offers, the visitor's data, the price and the button. */
export function OrderForm({ props }: { props: OrderFormProps }) {
  const { data, mode } = usePage();
  const router = useRouter();
  const product = data.product;
  const own = useImage(props.image_media_id);
  const productImages = useProductImages();
  const image = imageSrc(own ?? productImages[0] ?? null, "large");

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
  // An offer card picked an offer.
  useOfferChoice(form.chooseOffer);

  return (
    <section id="order" className="sl-section sl-band scroll-mt-4">
      <div className="sl-wrap">
        <div className="flex flex-col items-center gap-3 text-center">
          {props.kicker ? <span className="sl-kicker">{props.kicker}</span> : null}
          <h2 className="sl-display sl-title">{props.title}</h2>
          <Ornament className="mt-1" />
          {props.subtitle ? <p className="as-base as-muted">{props.subtitle}</p> : null}
        </div>

        <div className="mt-10 grid items-start gap-6 @4xl:grid-cols-[1fr_1.2fr] @4xl:gap-10">
          {product ? (
            <aside className="overflow-hidden rounded-(--sl-radius) border bg-(--as-bg) @4xl:sticky @4xl:top-5">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
                <img src={image} alt="" className="aspect-[4/3] w-full object-cover @4xl:aspect-[4/5]" />
              ) : null}
              <div className="flex flex-col gap-4 p-6">
                <span className="sl-kicker">{t.form.yourOrder}</span>
                <h3 className="sl-display as-2xl">{product.name}</h3>
                {props.points.length ? (
                  <ul className="as-sm flex flex-col gap-2.5">
                    {props.points.map((point, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="size-1.5 shrink-0 rotate-45 bg-(--as-primary)" aria-hidden />
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="as-xs flex flex-wrap gap-2 border-t pt-4 font-semibold">
                  <span className="sl-pill">
                    <Truck className="size-3.5 text-(--as-primary)" aria-hidden />
                    {ar.bidaya.homeDelivery}
                  </span>
                  <span className="sl-pill">
                    <Banknote className="size-3.5 text-(--as-primary)" aria-hidden />
                    {f.cod}
                  </span>
                </div>
              </div>
            </aside>
          ) : null}

          <div className="flex flex-col gap-5 rounded-(--sl-radius) border bg-(--as-bg) p-5 shadow-[0_40px_80px_-50px_rgb(0_0_0/0.45)] @3xl:p-8">
            {form.unavailable && mode === "live" ? <p className="as-sm rounded-lg bg-red-50 p-3 font-semibold text-red-700">{f.unavailable}</p> : null}

            {form.picker && product ? (
              <fieldset className="flex flex-col gap-2.5">
                <legend className="as-sm mb-1 font-bold">{f.offers}</legend>
                <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={f.offers}>
                  {[0, ...form.offers.map((o) => o.id)].map((id) => {
                    const offer = form.offers.find((o) => o.id === id) ?? null;
                    const deal = dealOf(offer, product.price);
                    const selected = form.chosenOffer === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => form.chooseOffer(id)}
                        className={cn("flex items-center gap-3 rounded-2xl border p-4 text-start transition", selected ? "border-(--as-primary) bg-(--sl-soft)" : "hover:border-(--as-primary)/60")}
                      >
                        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected && "border-(--as-primary) bg-(--as-primary) text-(--as-on-primary)")} aria-hidden>
                          {selected ? <Check className="size-3" /> : null}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="as-sm font-bold">{offer ? offer.name : t.bundles.piece}</span>
                          {offer ? <span className="as-xs as-muted">{t.bundles.pieces(deal.quantity)}</span> : null}
                        </span>
                        <span className="flex shrink-0 flex-col items-end leading-tight">
                          <b className="as-lg font-extrabold whitespace-nowrap">{formatMoney(deal.total)}</b>
                          {deal.was > deal.total ? <s className="as-xs as-muted">{formatMoney(deal.was)}</s> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

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
                        className={cn("as-sm flex items-center gap-2 rounded-full border font-semibold transition", swatch ? "p-1" : "px-4 py-2", selected ? (swatch ? "border-(--as-primary) ring-2 ring-(--as-primary) ring-offset-2 ring-offset-(--as-bg)" : "border-(--as-text) bg-(--as-text) text-(--as-bg)") : "hover:border-(--as-primary)/60")}
                      >
                        {swatch ? <span className="size-8 rounded-full border" style={{ background: v.color_hex! }} aria-hidden /> : null}
                        <span className={swatch ? "sr-only" : undefined}>{v.label}</span>
                        {v.price_delta && !swatch ? <span className="as-xs opacity-75">{`${v.price_delta > 0 ? "+" : "−"}${formatMoney(Math.abs(v.price_delta))}`}</span> : null}
                      </button>
                    );
                  })}
                </div>
                {form.errors[`options.${option.id}`] ? <p className="as-xs font-semibold text-red-600">{form.errors[`options.${option.id}`]}</p> : null}
              </fieldset>
            ))}
            <CustomerInputFields state={form.inputs} classes={{ control: "rounded-xl" }} />

            <div className="grid gap-3.5 @md:grid-cols-2">
              {form.fields.map((key) => {
                const id = `sl-${key}`;
                const error = form.errors[`customer.${key}`];
                const wide = key === "address" || key === "notes";
                const common = { id, "data-field": `customer.${key}`, "aria-invalid": Boolean(error), className: "bd-field as-base", value: form.values[key] ?? "", onFocus: form.touch };
                return (
                  <div key={key} className={cn("flex flex-col gap-1.5", wide && "@md:col-span-2")}>
                    <label htmlFor={id} className="as-sm font-semibold">
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
                <legend className="as-sm mb-1 font-bold">{f.shipping}</legend>
                {q.shipping_options.map((option) => {
                  const selected = (form.company ?? q.shipping_company?.id) === option.id;
                  return (
                    <button key={option.id} type="button" role="radio" aria-checked={selected} onClick={() => form.setCompany(option.id)} className={cn("as-sm flex items-center justify-between gap-2 rounded-xl border p-3 text-start", selected ? "border-(--as-primary) bg-(--sl-soft)" : "")}>
                      <span className="font-semibold">
                        {option.name}
                        <span className="as-xs as-muted ms-2 font-normal">{c.shippingDays(option.days_min, option.days_max)}</span>
                      </span>
                      <b>{option.fee === 0 ? f.free : formatMoney(option.fee)}</b>
                    </button>
                  );
                })}
              </fieldset>
            ) : null}

            {props.show_quantity ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-(--sl-surface) px-4 py-3">
                <span className="as-sm font-bold">{f.quantity}</span>
                <QuantityStepper value={form.quantity} onChange={form.setQuantity} max={20} small />
              </div>
            ) : null}

            <CodeBox form={form} />
            <Summary quote={q} loading={form.quoteLoading} />

            {hasPaymentChoice(form.paymentOptions) ? <PaymentChoice options={form.paymentOptions} value={form.payment} onChange={form.setPayment} error={form.errors.payment_method} detail={form.transfer ? <TransferBox method={form.transfer} total={q?.total ?? null} draft={form.receipt} onDraft={form.setReceipt} error={form.receiptError} /> : null} /> : null}

            {form.formError ? (
              <p className="as-sm font-semibold text-red-600" role="alert">
                {form.formError}
              </p>
            ) : null}

            <button type="button" onClick={() => void form.submit()} disabled={form.submitting || (form.unavailable && mode === "live")} className="sl-btn sl-btn-gold as-lg h-14 w-full">
              {form.submitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ShieldCheck className="size-5" aria-hidden />}
              {form.submitting ? f.submitting : props.button_label}
              {q && !form.submitting ? <span className="opacity-90">· {formatMoney(q.total)}</span> : null}
            </button>
            <p className="as-xs as-muted flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center font-semibold">
              <span className="flex items-center gap-1.5">
                <Banknote className="size-3.5" aria-hidden />
                {f.cod}
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="size-3.5" aria-hidden />
                {f.secure}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
