"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, Loader2, ShoppingBag, Truck, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { formatMoney } from "@/lib/format";
import { formatPhoneLocal, normalizePhone } from "@/lib/phone";
import { useAccount, type Address } from "@/lib/store/account";
import { cartPayload, clearCart, useCart } from "@/lib/store/cart";
import { cartToken, resetCartToken, sendStoreEvent } from "@/lib/store/events";
import { GOVERNORATES } from "@/lib/store/governorates";
import { useCartQuote, type QuoteState } from "@/lib/store/quote";
import type { CartQuote, StoreConfig } from "@/lib/store/types";
import { track } from "@/lib/tracking/track";
import { captureUtm } from "@/lib/tracking/utm";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreLink } from "../context";
import { Breadcrumb, Container, Empty, FormField, inputClass } from "../parts";
import { CartLines, useHydrated } from "./cart";

const t = ar.storefront.checkout;
const ta = ar.storefront.checkoutAccount;

const schema = z.object({
  name: z.string().trim().min(2, t.errors.name).max(80, t.errors.name),
  phone: z.string().trim().refine((v) => normalizePhone(v) !== null, t.errors.phone),
  governorate: z.string().refine((v) => (GOVERNORATES as readonly string[]).includes(v), t.errors.governorate),
  city: z.string().trim().max(100),
  address: z.string().trim().min(5, t.errors.address).max(300, t.errors.address),
  notes: z.string().trim().max(500),
  website: z.string().max(200),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["name", "phone", "governorate", "city", "address", "notes"] as const;

export function CheckoutView({ config }: { config: StoreConfig }) {
  const cart = useCart();
  const hydrated = useHydrated();
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", phone: "", governorate: "", city: "", address: "", notes: "", website: "" }, mode: "onTouched" });
  const { register, handleSubmit, setError, formState, control } = form;
  const governorate = useWatch({ control, name: "governorate" });
  const phone = normalizePhone(useWatch({ control, name: "phone" }));
  const name = useWatch({ control, name: "name" });

  const [token, setToken] = React.useState<string | null>(null);
  const [codeInput, setCodeInput] = React.useState("");
  const [code, setCode] = React.useState<string | null>(null);
  const [companyId, setCompanyId] = React.useState<number | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [lineErrors, setLineErrors] = React.useState<Record<number, string>>({});
  const [placing, setPlacing] = React.useState(false);
  // Signed in: the details come from the account; "new" = typing a new address.
  const account = useAccount();
  const me = account.data ?? null;
  const [chosenAddress, setChosenAddress] = React.useState<number | "new" | null>(null);
  const [keepAddress, setKeepAddress] = React.useState(true);
  const filled = React.useRef(false);
  const preferred = me ? (me.addresses.find((a) => a.is_default) ?? me.addresses[0] ?? null) : null;
  // Until the customer picks, the default saved address is the one in use.
  const addressId = chosenAddress ?? preferred?.id ?? "new";

  /** Puts an address in the form; `onlyEmpty` (the first fill) never replaces what the customer already typed. */
  const fillAddress = React.useCallback(
    (address: Address | null, onlyEmpty = false) => {
      const opts = { shouldValidate: false, shouldDirty: true } as const;
      const put = (field: "governorate" | "city" | "address" | "name", value: string) => {
        if (!onlyEmpty || !String(form.getValues(field) ?? "").trim()) form.setValue(field, value, opts);
      };
      put("governorate", address?.governorate ?? "");
      put("city", address?.city ?? "");
      put("address", address?.address ?? "");
      if (address?.name) put("name", address.name);
    },
    [form],
  );
  const pickAddress = (address: Address | null) => {
    setChosenAddress(address ? address.id : "new");
    fillAddress(address);
  };

  React.useEffect(() => {
    if (!me || filled.current) return;
    filled.current = true;
    form.setValue("phone", formatPhoneLocal(me.phone));
    if (me.name && !form.getValues("name")) form.setValue("name", me.name);
    if (preferred) fillAddress(preferred, true);
  }, [me, form, fillAddress, preferred]);

  const quote = useCartQuote(cart, { code, governorate: governorate || null, phone, shipping_company_id: companyId });
  const shown: QuoteState = { ...quote, lineErrors: { ...quote.lineErrors, ...lineErrors } };
  const shippingOn = config.shipping.enabled;

  // Anti-bot token, the checkout counter and the pixel event, once.
  React.useEffect(() => {
    let alive = true;
    fetch("/api/public/store/form-token", { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((json: { data?: { token?: string } }) => alive && setToken(json.data?.token ?? null))
      .catch(() => undefined);
    sendStoreEvent("checkout");
    return () => {
      alive = false;
    };
  }, []);
  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current || cart.items.length === 0) return;
    started.current = true;
    track("InitiateCheckout", { content_ids: cart.items.map((i) => i.product_id), value: cart.items.reduce((s, i) => s + i.price * i.quantity, 0), num_items: cart.items.reduce((s, i) => s + i.quantity, 0) });
  }, [cart.items]);

  // A phone typed but no order yet: the store can call back (abandoned checkout).
  const sentLead = React.useRef<string | null>(null);
  const items = JSON.stringify(cartPayload(cart));
  React.useEffect(() => {
    if (!phone || !token || sentLead.current === phone || items === "[]") return;
    const timer = window.setTimeout(() => {
      sentLead.current = phone;
      fetch("/api/public/store/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: JSON.parse(items), phone, name: name.trim() || null, governorate: governorate || null, form_token: token, cart_token: cartToken() || null }),
        keepalive: true,
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [phone, token, items, name, governorate]);

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    setLineErrors({});
    setPlacing(true);
    try {
      const response = await fetch("/api/public/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: cartPayload(cart),
          customer: { name: values.name, phone: values.phone, governorate: values.governorate, city: values.city || null, address: values.address, notes: values.notes || null },
          code,
          shipping_company_id: shippingOn ? (companyId ?? quote.quote?.shipping_company?.id ?? null) : null,
          form_token: token,
          website: values.website,
          utm: captureUtm(),
          cart_token: cartToken() || null,
          save_address: me !== null && addressId === "new" && keepAddress,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { data?: { order_number: number; total: number }; errors?: Record<string, string[]>; message?: string };
      if (response.ok && json.data) {
        track("Purchase", { content_ids: cart.items.map((i) => i.product_id), value: json.data.total, num_items: cart.items.reduce((s, i) => s + i.quantity, 0), transaction_id: json.data.order_number });
        clearCart();
        resetCartToken();
        router.replace(`/checkout/done?order=${json.data.order_number}&total=${json.data.total}`);
        return;
      }
      if (response.status === 422 && json.errors) {
        const lines: Record<number, string> = {};
        for (const [key, messages] of Object.entries(json.errors)) {
          const field = key.replace(/^customer\./, "") as (typeof FIELDS)[number];
          if (key.startsWith("customer.") && FIELDS.includes(field)) setError(field, { message: messages[0] });
          const line = key.match(/^items\.(\d+)/);
          if (line) lines[Number(line[1])] ??= messages[0] ?? "";
        }
        setLineErrors(lines);
        const other = json.errors.code?.[0] ?? json.errors.shipping_company_id?.[0] ?? (Object.keys(lines).length ? t.errors.cart : null);
        setFailure(other ?? (Object.keys(json.errors).some((k) => k.startsWith("customer.")) ? t.errors.fix : (json.message ?? t.errors.generic)));
        return;
      }
      setFailure(json.message ?? t.errors.generic);
    } catch {
      setFailure(t.errors.network);
    } finally {
      setPlacing(false);
    }
  });

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
  const selectedCompany = companyId ?? q?.shipping_company?.id ?? null;
  const err = (key: keyof Values) => formState.errors[key]?.message ?? null;
  const aria = (key: keyof Values) => ({ "aria-invalid": err(key) ? true : undefined, "aria-describedby": err(key) ? `co-${key}-error` : undefined });

  return (
    <Container className="flex flex-col gap-5 py-6 @3xl:py-8">
      <Breadcrumb items={[{ name: ar.storefront.cartPage.title, href: "/cart" }, { name: t.title }]} />
      <h1 className="as-2xl font-extrabold">{t.title}</h1>

      <form onSubmit={onSubmit} noValidate className="grid items-start gap-6 @4xl:grid-cols-[1fr_22rem]">
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
            <FormField id="co-address" label={t.address} hint={t.addressHint} error={err("address")}>
              <input id="co-address" autoComplete="street-address" maxLength={300} className={inputClass} {...register("address")} {...aria("address")} />
            </FormField>
            <FormField id="co-notes" label={t.notes} error={err("notes")} optional>
              <textarea id="co-notes" rows={2} maxLength={500} className={cn(inputClass, "h-auto py-2")} {...register("notes")} />
            </FormField>
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
            input={codeInput}
            onInput={setCodeInput}
            applied={code}
            quote={q}
            error={quote.codeError}
            onApply={() => setCode(codeInput.trim().toUpperCase() || null)}
            onRemove={() => {
              setCode(null);
              setCodeInput("");
            }}
          />
          <Summary quote={quote} shippingOn={shippingOn} governorate={governorate} />
          {failure ? (
            <p className="as-sm rounded-lg bg-red-50 p-3 font-semibold text-red-700" role="alert">
              {failure}
            </p>
          ) : null}
          <button type="submit" disabled={placing || !token} className="as-btn as-base h-12 w-full disabled:cursor-wait disabled:opacity-60">
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
