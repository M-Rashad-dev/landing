"use client";

import { Banknote, Loader2, ShoppingBag, Truck, UserRound, X } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { formatPhoneLocal } from "@/lib/phone";
import { GOVERNORATES } from "@/lib/store/governorates";
import type { QuoteState } from "@/lib/store/quote";
import type { CartQuote, StoreConfig } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreLink, useHydrated } from "@/themes/store/shared/context";
import { useCheckout, type CheckoutValues } from "@/themes/store/shared/use-checkout";
import { Breadcrumb, Container, Empty, FormField, inputClass } from "../parts";
import { CartLines } from "./cart";

const t = ar.storefront.checkout;
const ta = ar.storefront.checkoutAccount;

export function CheckoutView({ config }: { config: StoreConfig }) {
  const hydrated = useHydrated();
  const checkout = useCheckout(config);
  const { cart, form, governorate, me, account, addressId, pickAddress, keepAddress, setKeepAddress, whatsappOptIn, setWhatsappOptIn, quote, shown, shippingOn, selectedCompany, setCompanyId, failure, placing } = checkout;
  const { register, formState } = form;

  if (!hydrated) return <Container className="min-h-[50vh] py-8">{null}</Container>;
  if (cart.items.length === 0) {
    return (
      <Container className="py-8">
        <Empty
          icon={<ShoppingBag className="size-6" />}
          title={t.empty}
          action={
            <StoreLink href="/products" className="as-btn as-sm">
              {ar.storefront.cartPage.shop}
            </StoreLink>
          }
        />
      </Container>
    );
  }

  const q = quote.quote;
  const options = q?.shipping_options ?? [];
  const err = (key: keyof CheckoutValues) => formState.errors[key]?.message ?? null;
  const aria = (key: keyof CheckoutValues) => ({ "aria-invalid": err(key) ? true : undefined, "aria-describedby": err(key) ? `co-${key}-error` : undefined });

  return (
    <Container className="flex flex-col gap-5 py-6 @3xl:py-8">
      <Breadcrumb items={[{ name: ar.storefront.cartPage.title, href: "/cart" }, { name: t.title }]} />
      <h1 className="as-2xl font-extrabold">{t.title}</h1>

      <form onSubmit={checkout.submit} noValidate className="grid items-start gap-6 @4xl:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {account.isSuccess && !me ? (
            <p className="as-sm flex flex-wrap items-center gap-x-2 rounded-xl bg-(--as-soft) px-4 py-3">
              <UserRound className="size-4 as-primary" aria-hidden />
              <span>{ta.haveAccount}</span>
              <StoreLink href="/account/login?next=/checkout" className="font-bold as-primary hover:underline">
                {ta.signIn}
              </StoreLink>
            </p>
          ) : null}
          <section className="flex flex-col gap-4 rounded-2xl border p-4 @3xl:p-5">
            <h2 className="as-lg font-bold">{t.contact}</h2>
            {me && me.addresses.length ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="as-sm mb-2 font-semibold">{ta.savedAddresses}</legend>
                {me.addresses.map((a) => (
                  <label key={a.id} className={cn("as-sm flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3", addressId === a.id ? "border-(--as-primary) bg-(--as-soft)" : "hover:border-(--as-primary)/40")}>
                    <input type="radio" name="saved_address" checked={addressId === a.id} onChange={() => pickAddress(a)} className="mt-1 size-4 accent-(--as-primary)" />
                    <span className="flex flex-col">
                      <b>{a.name}</b>
                      <span className="as-muted">{[a.address, a.city, a.governorate].filter(Boolean).join("، ")}</span>
                    </span>
                  </label>
                ))}
                <label className={cn("as-sm flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 font-semibold", addressId === "new" ? "border-(--as-primary) bg-(--as-soft)" : "hover:border-(--as-primary)/40")}>
                  <input type="radio" name="saved_address" checked={addressId === "new"} onChange={() => pickAddress(null)} className="size-4 accent-(--as-primary)" />
                  {ta.newAddress}
                </label>
              </fieldset>
            ) : null}
            <div className="grid gap-4 @3xl:grid-cols-2">
              <FormField id="co-name" label={t.name} error={err("name")}>
                <input id="co-name" autoComplete="name" maxLength={80} className={inputClass} {...register("name")} {...aria("name")} />
              </FormField>
              <FormField id="co-phone" label={t.phone} hint={me ? ta.signedInAs(formatPhoneLocal(me.phone)) : t.phoneHint} error={err("phone")}>
                <input id="co-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} readOnly={me !== null} className={cn(inputClass, "text-end", me && "opacity-70")} {...register("phone")} {...aria("phone")} />
              </FormField>
              <FormField id="co-governorate" label={t.governorate} error={err("governorate")}>
                <select id="co-governorate" className={inputClass} {...register("governorate")} {...aria("governorate")}>
                  <option value="">{t.chooseGovernorate}</option>
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="co-city" label={t.city} error={err("city")} optional>
                <input id="co-city" autoComplete="address-level2" maxLength={100} className={inputClass} {...register("city")} {...aria("city")} />
              </FormField>
            </div>
            <FormField id="co-email" label={t.email} hint={t.emailHint} error={err("email")} optional>
              <input id="co-email" type="email" inputMode="email" autoComplete="email" dir="ltr" maxLength={191} className={cn(inputClass, "text-end")} {...register("email")} {...aria("email")} />
            </FormField>
            <FormField id="co-address" label={t.address} hint={t.addressHint} error={err("address")}>
              <input id="co-address" autoComplete="street-address" maxLength={300} className={inputClass} {...register("address")} {...aria("address")} />
            </FormField>
            <FormField id="co-notes" label={t.notes} error={err("notes")} optional>
              <textarea id="co-notes" rows={2} maxLength={500} className={cn(inputClass, "h-auto py-2")} {...register("notes")} />
            </FormField>
            <label className="as-sm flex items-start gap-2 font-semibold">
              <input type="checkbox" checked={whatsappOptIn} onChange={(e) => setWhatsappOptIn(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-(--as-primary)" />
              <span>
                {t.whatsappOptIn}
                <span className="as-xs as-muted block font-normal">{t.whatsappOptInHint}</span>
              </span>
            </label>
            {me && addressId === "new" ? (
              <label className="as-sm flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={keepAddress} onChange={(e) => setKeepAddress(e.target.checked)} className="size-4 accent-(--as-primary)" />
                {ta.saveAddress}
              </label>
            ) : null}
            {/* Honeypot: people never see it, bots fill it. */}
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] size-px opacity-0" {...register("website")} />
          </section>

          {shippingOn ? (
            <section className="flex flex-col gap-3 rounded-2xl border p-4 @3xl:p-5">
              <h2 className="as-lg flex items-center gap-2 font-bold">
                <Truck className="size-5 as-primary" aria-hidden />
                {t.shipping}
              </h2>
              {!governorate ? (
                <p className="as-sm as-muted">{t.shippingPickGovernorate}</p>
              ) : q && !q.shipping_available ? (
                <p className="as-sm font-semibold text-red-600">{t.shippingUnavailable}</p>
              ) : options.length > 1 ? (
                <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.shippingChoose}>
                  {options.map((o) => (
                    <label key={o.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3", selectedCompany === o.id ? "border-(--as-primary) bg-(--as-soft)" : "hover:border-(--as-primary)/40")}>
                      <input type="radio" name="shipping_company" checked={selectedCompany === o.id} onChange={() => setCompanyId(o.id)} className="size-4 accent-(--as-primary)" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="as-sm font-semibold">{o.name}</span>
                        <span className="as-xs as-muted">{[t.shippingDays(o.days_min, o.days_max), o.offer].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="as-sm flex flex-col items-end font-bold">
                        {o.fee === 0 ? t.free : formatMoney(o.fee)}
                        {o.original > o.fee ? <span className="as-xs as-muted font-normal line-through">{formatMoney(o.original)}</span> : null}
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

          <section className="flex flex-col gap-3 rounded-2xl border p-4 @3xl:p-5">
            <h2 className="as-lg font-bold">{t.payment}</h2>
            <div className="flex items-center gap-3 rounded-xl border-2 border-(--as-primary) bg-(--as-soft) p-3">
              <Banknote className="size-6 shrink-0 as-primary" aria-hidden />
              <span className="flex flex-col">
                <span className="as-sm font-bold">{t.cod}</span>
                <span className="as-xs as-muted">{t.codHint}</span>
              </span>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 rounded-2xl border bg-(--as-card) p-4 @4xl:sticky @4xl:top-24">
          <h2 className="as-lg font-bold">{t.summary}</h2>
          <CartLines cart={cart} quote={shown} editable={false} />
          <CodeBox
            input={checkout.codeInput}
            onInput={checkout.setCodeInput}
            applied={checkout.code}
            quote={q}
            error={quote.codeError}
            onApply={checkout.applyCode}
            onRemove={checkout.removeCode}
          />
          <Summary quote={quote} shippingOn={shippingOn} governorate={governorate} />
          {failure ? (
            <p className="as-sm rounded-lg bg-red-50 p-3 font-semibold text-red-700" role="alert">
              {failure}
            </p>
          ) : null}
          <button type="submit" disabled={placing || !checkout.ready} className="as-btn as-base h-12 w-full disabled:cursor-wait disabled:opacity-60">
            {placing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {placing ? t.submitting : t.submit}
          </button>
          <StoreLink href="/cart" className="as-sm text-center font-semibold as-primary hover:underline">
            {t.backToCart}
          </StoreLink>
        </aside>
      </form>
    </Container>
  );
}

function CodeBox({ input, onInput, applied, quote, error, onApply, onRemove }: { input: string; onInput: (v: string) => void; applied: string | null; quote: CartQuote | null; error: string | null; onApply: () => void; onRemove: () => void }) {
  const ok = applied && quote?.code === applied && !error;
  if (ok) {
    return (
      <p className="as-sm flex items-center justify-between rounded-lg bg-(--as-soft) px-3 py-2 font-semibold as-primary">
        {t.codeApplied(applied)}
        <button type="button" onClick={onRemove} className="flex size-7 items-center justify-center rounded-md hover:bg-(--as-bg)" aria-label={t.removeCode}>
          <X className="size-4" />
        </button>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="co-code" className="sr-only">
        {t.code}
      </label>
      <div className="flex gap-2">
        <input
          id="co-code"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply();
            }
          }}
          placeholder={t.codePlaceholder}
          maxLength={30}
          dir="ltr"
          className={cn(inputClass, "h-10 uppercase")}
          aria-invalid={applied && error ? true : undefined}
        />
        <button type="button" onClick={onApply} disabled={!input.trim()} className="as-sm h-10 shrink-0 rounded-lg border px-4 font-bold hover:bg-(--as-soft) disabled:opacity-50">
          {t.applyCode}
        </button>
      </div>
      {applied && error ? (
        <p className="as-xs font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Summary({ quote, shippingOn, governorate }: { quote: QuoteState; shippingOn: boolean; governorate: string }) {
  const q = quote.quote;
  if (!q) return <div className="h-24 animate-pulse rounded-lg bg-(--as-soft)" aria-busy />;
  const shipping = !shippingOn ? null : !governorate ? t.shippingLater : !q.shipping_available ? "—" : q.shipping_free || q.shipping === 0 ? t.free : q.shipping !== null ? formatMoney(q.shipping) : t.shippingLater;
  return (
    <dl className={cn("flex flex-col gap-2 border-t pt-3", quote.loading && "opacity-60 transition-opacity")} aria-busy={quote.loading}>
      <Row label={t.subtotal} value={formatMoney(q.subtotal)} />
      {q.offer_discount > 0 ? <Row label={t.offerDiscount} value={`−${formatMoney(q.offer_discount)}`} accent /> : null}
      {q.code_discount > 0 ? <Row label={t.codeDiscount} value={`−${formatMoney(q.code_discount)}`} accent /> : null}
      {shipping !== null ? <Row label={t.shippingFee} value={shipping} accent={q.shipping_free} /> : null}
      <div className="as-lg flex justify-between border-t pt-2 font-extrabold">
        <dt>{t.total}</dt>
        <dd>{formatMoney(q.total)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("as-sm flex justify-between", accent && "as-primary")}>
      <dt className={accent ? undefined : "as-muted"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
