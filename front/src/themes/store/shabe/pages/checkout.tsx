"use client";

import { Banknote, Loader2, ShoppingBag, Truck, UserRound, X } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { formatPhoneLocal } from "@/lib/phone";
import { GOVERNORATES } from "@/lib/store/governorates";
import type { QuoteState } from "@/lib/store/quote";
import type { StoreConfig } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { hasPaymentChoice, PaymentChoice } from "@/themes/shared/payment-choice";
import { StoreLink, useHydrated } from "@/themes/store/shared/context";
import { useCheckout, type CheckoutValues } from "@/themes/store/shared/use-checkout";
import { ShabeCartLines } from "./cart";

const t = ar.storefront.checkout;
const ta = ar.storefront.checkoutAccount;

const input = "as-base h-12 w-full rounded-2xl border-2 bg-(--as-bg) px-4 outline-none transition focus:border-(--as-primary) aria-[invalid=true]:border-red-500";

function Field({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error: string | null; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="as-sm font-extrabold">
        {label}
        {optional ? <span className="as-xs ms-1 font-normal as-muted">({ar.common.optional})</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="as-xs font-bold text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="as-xs as-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Totals({ quote, shippingOn, governorate }: { quote: QuoteState; shippingOn: boolean; governorate: string }) {
  const q = quote.quote;
  if (!q) return <div className="h-24 animate-pulse rounded-2xl bg-(--ss-soft)" aria-busy />;
  const shipping = !shippingOn ? null : !governorate ? t.shippingLater : !q.shipping_available ? "—" : q.shipping_free || q.shipping === 0 ? t.free : q.shipping !== null ? formatMoney(q.shipping) : t.shippingLater;
  const row = (label: string, value: string, accent = false) => (
    <div className={cn("as-sm flex justify-between", accent && "text-(--as-primary)")}>
      <dt className={accent ? undefined : "as-muted"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <dl className={cn("flex flex-col gap-2 border-t pt-3", quote.loading && "opacity-60 transition-opacity")} aria-busy={quote.loading}>
      {row(t.subtotal, formatMoney(q.subtotal))}
      {q.offer_discount > 0 ? row(t.offerDiscount, `−${formatMoney(q.offer_discount)}`, true) : null}
      {q.code_discount > 0 ? row(t.codeDiscount, `−${formatMoney(q.code_discount)}`, true) : null}
      {shipping !== null ? row(t.shippingFee, shipping, q.shipping_free) : null}
      <div className="as-xl flex justify-between border-t pt-2 font-black">
        <dt>{t.total}</dt>
        <dd>{formatMoney(q.total)}</dd>
      </div>
    </dl>
  );
}

/** «شابع»'s checkout, drawn on the shared checkout logic (useCheckout): the same form, rules and order. */
export function ShabeCheckoutView({ config }: { config: StoreConfig }) {
  const hydrated = useHydrated();
  const c = useCheckout(config);
  const { cart, form, governorate, me, account, addressId, pickAddress, quote, shown, shippingOn, selectedCompany, failure, placing } = c;
  const { register, formState } = form;
  const err = (key: keyof CheckoutValues) => formState.errors[key]?.message ?? null;
  const aria = (key: keyof CheckoutValues) => ({ "aria-invalid": err(key) ? true : undefined, "aria-describedby": err(key) ? `sc-${key}-error` : undefined });
  const q = quote.quote;
  const options = q?.shipping_options ?? [];
  const card = "ss-card flex flex-col gap-4 p-5 @3xl:p-6";

  if (!hydrated) return <div className="ss-wrap min-h-[50vh] py-8" />;
  if (cart.items.length === 0) {
    return (
      <div className="ss-wrap flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-(--ss-soft) text-(--as-primary)">
          <ShoppingBag className="size-8" aria-hidden />
        </span>
        <p className="ss-display as-xl">{t.empty}</p>
        <StoreLink href="/products" className="ss-btn ss-btn-fire as-base h-12 px-8">
          {ar.storefront.cartPage.shop}
        </StoreLink>
      </div>
    );
  }

  return (
    <div className="ss-wrap flex flex-col gap-6 py-8 @3xl:py-12">
      <h1 className="ss-display ss-title">{t.title}</h1>
      <form onSubmit={c.submit} noValidate className="grid items-start gap-6 @4xl:grid-cols-[1fr_23rem]">
        <div className="flex flex-col gap-5">
          {account.isSuccess && !me ? (
            <p className="as-sm flex flex-wrap items-center gap-x-2 rounded-3xl bg-(--ss-soft) px-5 py-3">
              <UserRound className="size-4 text-(--as-primary)" aria-hidden />
              <span>{ta.haveAccount}</span>
              <StoreLink href="/account/login?next=/checkout" className="font-extrabold text-(--as-primary) hover:underline">
                {ta.signIn}
              </StoreLink>
            </p>
          ) : null}

          <section className={card}>
            <h2 className="ss-display as-2xl">{t.contact}</h2>
            {me && me.addresses.length ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="as-sm mb-2 font-extrabold">{ta.savedAddresses}</legend>
                {me.addresses.map((a) => (
                  <label key={a.id} className={cn("as-sm flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3", addressId === a.id ? "border-(--as-primary) bg-(--ss-soft)" : "hover:border-(--as-primary)/40")}>
                    <input type="radio" name="saved_address" checked={addressId === a.id} onChange={() => pickAddress(a)} className="mt-1 size-4 accent-(--as-primary)" />
                    <span className="flex flex-col">
                      <b>{a.name}</b>
                      <span className="as-muted">{[a.address, a.city, a.governorate].filter(Boolean).join("، ")}</span>
                    </span>
                  </label>
                ))}
                <label className={cn("as-sm flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 font-bold", addressId === "new" ? "border-(--as-primary) bg-(--ss-soft)" : "hover:border-(--as-primary)/40")}>
                  <input type="radio" name="saved_address" checked={addressId === "new"} onChange={() => pickAddress(null)} className="size-4 accent-(--as-primary)" />
                  {ta.newAddress}
                </label>
              </fieldset>
            ) : null}
            <div className="grid gap-4 @3xl:grid-cols-2">
              <Field id="sc-name" label={t.name} error={err("name")}>
                <input id="sc-name" autoComplete="name" maxLength={80} className={input} {...register("name")} {...aria("name")} />
              </Field>
              <Field id="sc-phone" label={t.phone} hint={me ? ta.signedInAs(formatPhoneLocal(me.phone)) : t.phoneHint} error={err("phone")}>
                <input id="sc-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} readOnly={me !== null} className={cn(input, "text-end", me && "opacity-70")} {...register("phone")} {...aria("phone")} />
              </Field>
              <Field id="sc-governorate" label={t.governorate} error={err("governorate")}>
                <select id="sc-governorate" className={input} {...register("governorate")} {...aria("governorate")}>
                  <option value="">{t.chooseGovernorate}</option>
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="sc-city" label={t.city} error={err("city")} optional>
                <input id="sc-city" autoComplete="address-level2" maxLength={100} className={input} {...register("city")} {...aria("city")} />
              </Field>
            </div>
            <Field id="sc-address" label={t.address} hint={t.addressHint} error={err("address")}>
              <input id="sc-address" autoComplete="street-address" maxLength={300} className={input} {...register("address")} {...aria("address")} />
            </Field>
            <Field id="sc-email" label={t.email} hint={t.emailHint} error={err("email")} optional>
              <input id="sc-email" type="email" inputMode="email" autoComplete="email" dir="ltr" maxLength={191} className={cn(input, "text-end")} {...register("email")} {...aria("email")} />
            </Field>
            <Field id="sc-notes" label={t.notes} error={err("notes")} optional>
              <textarea id="sc-notes" rows={2} maxLength={500} className={cn(input, "h-auto py-3")} {...register("notes")} />
            </Field>
            {hasPaymentChoice(c.paymentOptions) ? <PaymentChoice options={c.paymentOptions} value={c.payment} onChange={c.setPayment} error={c.paymentError} /> : null}
            <label className="as-sm flex items-start gap-2 font-bold">
              <input type="checkbox" checked={c.whatsappOptIn} onChange={(e) => c.setWhatsappOptIn(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-(--as-primary)" />
              <span>
                {t.whatsappOptIn}
                <span className="as-xs block font-normal as-muted">{t.whatsappOptInHint}</span>
              </span>
            </label>
            {me && addressId === "new" ? (
              <label className="as-sm flex items-center gap-2 font-bold">
                <input type="checkbox" checked={c.keepAddress} onChange={(e) => c.setKeepAddress(e.target.checked)} className="size-4 accent-(--as-primary)" />
                {ta.saveAddress}
              </label>
            ) : null}
            {/* Honeypot: people never see it, bots fill it. */}
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] size-px opacity-0" {...register("website")} />
          </section>

          {shippingOn ? (
            <section className={card}>
              <h2 className="ss-display as-2xl flex items-center gap-2">
                <Truck className="size-6 text-(--as-primary)" aria-hidden />
                {t.shipping}
              </h2>
              {!governorate ? (
                <p className="as-sm as-muted">{t.shippingPickGovernorate}</p>
              ) : q && !q.shipping_available ? (
                <p className="as-sm font-bold text-red-600">{t.shippingUnavailable}</p>
              ) : options.length > 1 ? (
                <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.shippingChoose}>
                  {options.map((o) => (
                    <label key={o.id} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3", selectedCompany === o.id ? "border-(--as-primary) bg-(--ss-soft)" : "hover:border-(--as-primary)/40")}>
                      <input type="radio" name="shipping_company" checked={selectedCompany === o.id} onChange={() => c.setCompanyId(o.id)} className="size-4 accent-(--as-primary)" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="as-sm font-bold">{o.name}</span>
                        <span className="as-xs as-muted">{[t.shippingDays(o.days_min, o.days_max), o.offer].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="as-sm flex flex-col items-end font-black">
                        {o.fee === 0 ? t.free : formatMoney(o.fee)}
                        {o.original > o.fee ? <s className="as-xs font-normal as-muted">{formatMoney(o.original)}</s> : null}
                      </span>
                    </label>
                  ))}
                </div>
              ) : q?.shipping_company ? (
                <p className="as-sm">
                  <b>{q.shipping_company.name}</b> <span className="as-muted">{t.shippingDays(q.shipping_company.days_min, q.shipping_company.days_max)}</span>
                </p>
              ) : null}
            </section>
          ) : null}

          <section className={card}>
            <h2 className="ss-display as-2xl">{t.payment}</h2>
            <div className="flex items-center gap-3 rounded-2xl border-2 border-(--as-primary) bg-(--ss-soft) p-4">
              <Banknote className="size-7 shrink-0 text-(--as-primary)" aria-hidden />
              <span className="flex flex-col">
                <span className="as-sm font-extrabold">{t.cod}</span>
                <span className="as-xs as-muted">{t.codHint}</span>
              </span>
            </div>
          </section>
        </div>

        <aside className="ss-card flex flex-col gap-4 p-5 @4xl:sticky @4xl:top-28">
          <h2 className="ss-display as-2xl">{t.summary}</h2>
          <ShabeCartLines cart={cart} quote={shown} editable={false} />
          {c.code && q?.code === c.code && !quote.codeError ? (
            <p className="as-sm flex items-center justify-between rounded-2xl bg-(--ss-soft) px-4 py-2 font-bold text-(--as-primary)">
              {t.codeApplied(c.code)}
              <button type="button" onClick={c.removeCode} className="flex size-7 items-center justify-center rounded-full hover:bg-(--as-bg)" aria-label={t.removeCode}>
                <X className="size-4" />
              </button>
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <input
                  aria-label={t.code}
                  value={c.codeInput}
                  onChange={(e) => c.setCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      c.applyCode();
                    }
                  }}
                  placeholder={t.codePlaceholder}
                  maxLength={30}
                  dir="ltr"
                  className={cn(input, "h-11 uppercase")}
                  aria-invalid={c.code && quote.codeError ? true : undefined}
                />
                <button type="button" onClick={c.applyCode} disabled={!c.codeInput.trim()} className="ss-btn ss-btn-ghost as-sm h-11 shrink-0 disabled:opacity-50">
                  {t.applyCode}
                </button>
              </div>
              {c.code && quote.codeError ? (
                <p className="as-xs font-bold text-red-600" role="alert">
                  {quote.codeError}
                </p>
              ) : null}
            </div>
          )}
          <Totals quote={quote} shippingOn={shippingOn} governorate={governorate} />
          {failure ? (
            <p className="as-sm rounded-2xl bg-red-50 p-3 font-bold text-red-700" role="alert">
              {failure}
            </p>
          ) : null}
          <button type="submit" disabled={placing || !c.ready} className="ss-btn ss-btn-fire as-lg h-13 w-full disabled:cursor-wait disabled:opacity-60">
            {placing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {placing ? t.submitting : t.submit}
          </button>
          <StoreLink href="/cart" className="as-sm text-center font-extrabold text-(--as-primary) hover:underline">
            {t.backToCart}
          </StoreLink>
        </aside>
      </form>
    </div>
  );
}
