"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { isValidPhone, normalizePhone } from "@/lib/format/phone";
import { GOVERNORATES } from "@/lib/governorates";
import { formatPrice } from "@/lib/price";
import { cartPayload, clearCart, useCart } from "@/lib/store/cart";
import { sendStoreEvent } from "@/lib/store/events";
import { useCartQuote } from "@/lib/store/quote";
import { track } from "@/lib/tracking/track";
import { captureUtm } from "@/lib/tracking/utm";
import { cn } from "@/lib/utils";
import { orderFieldLabels, siteMessages } from "@/messages/site";
import { storePaths } from "@/themes/shared/store/links";
import type { PublicShipping } from "@/themes/types";

const t = siteMessages.store;
const s = siteMessages;
const noop = () => () => undefined;

const schema = z.object({
  name: z.string().trim().min(2, s.tooShort(2)).max(80, s.tooLong(80)),
  phone: z.string().trim().refine(isValidPhone, s.invalidPhone),
  governorate: z.string().min(1, s.required),
  city: z.string().trim().max(100, s.tooLong(100)),
  address: z.string().trim().min(1, s.required).max(300, s.tooLong(300)),
  notes: z.string().trim().max(500, s.tooLong(500)),
  code: z.string().trim().max(30),
  website: z.string(),
});
type Values = z.infer<typeof schema>;

type Placed = { order_number: number; total: number };

export function CheckoutView({ shipping, surface, input, button, muted }: { shipping: PublicShipping | undefined; surface: string; input: string; button: string; muted: string }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const cart = useCart();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", phone: "", governorate: "", city: "", address: "", notes: "", code: "", website: "" } });
  const { register, handleSubmit, formState, setError, control } = form;
  const { errors, isSubmitting } = formState;
  const governorate = useWatch({ control, name: "governorate" });
  const phone = useWatch({ control, name: "phone" });
  const name = useWatch({ control, name: "name" });
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const leadSent = useRef(false);
  const normalized = normalizePhone(phone);
  const { quote, loading, lineErrors } = useCartQuote(cart, { code: appliedCode, governorate: governorate || null, phone: normalized });
  const total = quote?.total ?? 0;

  // Anti-bot token + checkout counters, once.
  useEffect(() => {
    fetch("/api/public/store/form-token", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: { token?: string } } | null) => setToken(json?.data?.token ?? null))
      .catch(() => setToken(null));
    sendStoreEvent("checkout");
  }, []);

  const startedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || startedRef.current || cart.items.length === 0) return;
    startedRef.current = true;
    track("InitiateCheckout", { content_ids: cart.items.map((i) => i.product_id), num_items: cart.items.reduce((n, i) => n + i.quantity, 0), value: cart.items.reduce((n, i) => n + i.price * i.quantity, 0) });
  }, [hydrated, cart.items]);

  // Abandoned checkout: once, after a valid phone (the server keeps it only with the plan feature).
  useEffect(() => {
    if (leadSent.current || !normalized || !token || cart.items.length === 0 || placed) return;
    const timer = window.setTimeout(() => {
      leadSent.current = true;
      fetch("/api/public/store/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: cartPayload(cart), phone: normalized, name: name || null, governorate: governorate || null, form_token: token }),
        keepalive: true,
      }).catch(() => undefined);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [normalized, token, cart, name, governorate, placed]);

  if (!hydrated) return <div className={cn(surface, "h-96 animate-pulse")} aria-busy />;

  if (placed) {
    return (
      <div className={cn(surface, "mx-auto flex max-w-lg flex-col items-center gap-3 py-12 text-center")} data-testid="order-success">
        <CheckCircle2 className="size-12 text-green-600" aria-hidden />
        <h2 className="t-heading text-2xl font-extrabold">{t.successTitle}</h2>
        <p className="text-lg font-bold">{s.orderNumber(placed.order_number)}</p>
        <p className={muted}>{t.successText}</p>
        <p className="font-semibold">
          {s.total}: {formatPrice(placed.total)}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a href="/track" className={button}>
            {t.trackOrder}
          </a>
          <a href={storePaths.home} className={cn(muted, "self-center text-sm hover:underline")}>
            {t.backHome}
          </a>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className={cn(surface, "flex flex-col items-center gap-3 py-16 text-center")}>
        <p className="t-heading text-lg font-bold">{t.emptyCart}</p>
        <a href={storePaths.products} className={button}>
          {t.continueShopping}
        </a>
      </div>
    );
  }

  async function onSubmit(v: Values) {
    setFailure(null);
    try {
      const response = await fetch("/api/public/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: cartPayload(cart),
          customer: { name: v.name, phone: normalizePhone(v.phone), governorate: v.governorate, city: v.city || null, address: v.address, notes: v.notes || null },
          code: appliedCode,
          form_token: token,
          website: v.website,
          utm: captureUtm(),
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { data?: Placed; errors?: Record<string, string[]>; message?: string };
      if (response.ok && json.data) {
        const done = json.data;
        track("Purchase", { content_ids: cart.items.map((i) => i.product_id), num_items: cart.items.reduce((n, i) => n + i.quantity, 0), value: done.total, transaction_id: done.order_number });
        clearCart();
        setPlaced(done);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (response.status === 422 && json.errors) {
        let shown = false;
        for (const [key, messages] of Object.entries(json.errors)) {
          const field = key.startsWith("customer.") ? key.slice(9) : key;
          if (field in v) {
            setError(field as keyof Values, { message: messages[0] });
            shown = true;
          }
        }
        if (!shown) setFailure(Object.values(json.errors)[0]?.[0] ?? t.lineUnavailable);
        return;
      }
      setFailure(response.status === 429 ? siteMessages.track.tooMany : (json.message ?? s.rejected));
    } catch {
      setFailure(s.networkError);
    }
  }

  const fee = (g: string) => (shipping?.enabled ? (shipping.unavailable.includes(g) ? null : (shipping.fees[g] ?? null)) : null);
  const field = (key: keyof Values, label: string, node: ReactNode, required = false) => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      <span>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {node}
      {errors[key]?.message ? (
        <span className="text-xs font-normal text-red-600" role="alert">
          {errors[key]?.message}
        </span>
      ) : null}
    </label>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="checkout-form">
      <div className={cn(surface, "flex flex-col gap-4")}>
        <h2 className="t-heading text-lg font-bold">{t.customer}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", orderFieldLabels.name, <input className={input} autoComplete="name" maxLength={80} aria-invalid={!!errors.name} {...register("name")} />, true)}
          {field("phone", orderFieldLabels.phone, <input className={input} type="tel" dir="ltr" autoComplete="tel" inputMode="tel" maxLength={20} aria-invalid={!!errors.phone} {...register("phone")} />, true)}
          {field(
            "governorate",
            orderFieldLabels.governorate,
            <select className={input} autoComplete="address-level1" aria-invalid={!!errors.governorate} {...register("governorate")}>
              <option value="">{t.shippingChoose}</option>
              {GOVERNORATES.map((g) => {
                const f = fee(g);
                const closed = shipping?.enabled ? shipping.unavailable.includes(g) : false;
                return (
                  <option key={g} value={g} disabled={closed}>
                    {g}
                    {closed ? ` — ${s.shippingUnavailable}` : f !== null ? ` — ${f === 0 ? s.shippingFree : formatPrice(f)}` : ""}
                  </option>
                );
              })}
            </select>,
            true,
          )}
          {field("city", orderFieldLabels.city, <input className={input} autoComplete="address-level2" maxLength={100} {...register("city")} />)}
        </div>
        {field("address", orderFieldLabels.address, <textarea className={cn(input, "h-auto min-h-20 py-2")} rows={2} autoComplete="street-address" maxLength={300} aria-invalid={!!errors.address} {...register("address")} />, true)}
        {field("notes", orderFieldLabels.notes, <textarea className={cn(input, "h-auto min-h-16 py-2")} rows={2} maxLength={500} {...register("notes")} />)}
        {/* Honeypot: hidden from people, filled by bots. */}
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] h-0 w-0 opacity-0" {...register("website")} />
      </div>

      <aside className={cn(surface, "flex h-fit flex-col gap-3")} aria-live="polite">
        <p className="t-heading font-bold">{s.summary}</p>
        <ul className="flex flex-col gap-2 text-sm">
          {cart.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="min-w-0">
                <span className="line-clamp-1">
                  {item.name} × {item.quantity}
                </span>
                {item.options_label ? <span className={cn(muted, "block text-xs")}>{item.options_label}</span> : null}
                {lineErrors[i] ? <span className="block text-xs text-red-600">{lineErrors[i]}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">{formatPrice(quote?.lines[i]?.total ?? item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className={cn(input, "h-11")} placeholder={s.codePlaceholder} aria-label={s.code} maxLength={30} {...register("code")} />
          <button
            type="button"
            className={cn(button, "h-11 shrink-0 px-4")}
            onClick={() => {
              const value = form.getValues("code").trim();
              setAppliedCode(value === "" ? null : value);
            }}
          >
            {s.apply}
          </button>
        </div>
        {appliedCode && quote?.code_error ? <p className="text-xs text-red-600">{quote.code_error}</p> : null}
        <div className="flex flex-col gap-1.5 border-t border-[var(--c-border)] pt-3 text-sm">
          <Row label={s.subtotal} value={quote ? formatPrice(quote.subtotal) : "—"} />
          {quote && quote.offer_discount > 0 ? <Row label={s.offerDiscount} value={`− ${formatPrice(quote.offer_discount)}`} /> : null}
          {quote && quote.code_discount > 0 ? <Row label={s.codeDiscount} value={`− ${formatPrice(quote.code_discount)}`} /> : null}
          <Row label={s.shipping} value={!quote ? "—" : !quote.shipping_available ? s.shippingUnavailable : quote.shipping === null ? s.shippingPick : quote.shipping === 0 || quote.shipping_free ? s.shippingFree : formatPrice(quote.shipping)} />
          {shipping?.enabled && shipping.free_over ? <p className={cn(muted, "text-xs")}>{s.shippingFreeOver(formatPrice(shipping.free_over))}</p> : null}
          <Row label={s.total} value={quote ? formatPrice(total) : "—"} strong />
        </div>
        <p className={cn(muted, "text-xs")}>{loading ? t.updating : s.cod}</p>
        {failure ? (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">
            {failure}
          </p>
        ) : null}
        <button type="submit" disabled={isSubmitting || Object.keys(lineErrors).length > 0} className={cn(button, "w-full disabled:opacity-60")} data-testid="place-order">
          {isSubmitting ? t.placing : t.placeOrder}
        </button>
      </aside>
    </form>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={cn("flex items-center justify-between", strong && "text-base font-extrabold")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}
