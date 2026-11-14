"use client";

import * as React from "react";
import { abTestId } from "@/lib/ab/cookie";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { activeOffers, offerQuantity } from "@/lib/store/offers";
import { saveUpsell, type UpsellOfferData } from "@/lib/store/upsell";
import { track } from "@/lib/tracking/track";
import { captureUtm } from "@/lib/tracking/utm";
import { ar } from "@/messages/ar";
import type { PageMode } from "./context";
import type { FormFieldKey, LandingData, LandingQuote, OrderFormProps } from "./types";

const t = ar.bidaya.form;
const c = ar.storefront.checkout;

/** The order the visitor just placed, read by «طلبك وصل» (it fires the purchase event once). */
export const PLACED_KEY = "bd_placed";
export type Placed = { slug: string; number: number; total: number; quantity: number; product_id: number; product_name: string };

const ORDER = ["name", "phone", "phone2", "email", "governorate", "city", "address", "notes"] as const satisfies readonly FormFieldKey[];

type Status = "idle" | "submitting" | "error";

function post(url: string, body: unknown, signal?: AbortSignal) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), credentials: "same-origin", signal });
}

/** Device for the page counters. */
function device(): "mobile" | "desktop" {
  try {
    return window.matchMedia("(min-width: 768px) and (pointer: fine)").matches ? "desktop" : "mobile";
  } catch {
    return "mobile";
  }
}

/** First-party page counters (one visit per session, one form start per session). */
export function sendPageEvent(slug: string, type: "view" | "form_start"): void {
  const flag = `bd_ev_${type}_${slug}`;
  try {
    if (window.sessionStorage.getItem(flag) === "1") return;
    window.sessionStorage.setItem(flag, "1");
  } catch {
    // Storage blocked: count anyway.
  }
  const utm = captureUtm();
  fetch("/api/public/landing/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ slug, type, utm_source: utm.source ?? null, referrer: document.referrer || null, device: device(), ab: abTestId() }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Everything the order form does (the view only draws it): fields and their checks, product
 * options, quantity, offer cards, code, the live server price, the anti-bot token, the follow-up
 * of an abandoned form, and the order itself. In the Builder and previews nothing is sent.
 */
export function useLandingOrder(props: OrderFormProps, data: LandingData, mode: PageMode, onPlaced: (placed: Placed) => void) {
  const product = data.product;
  const slug = data.page.slug;
  const live = mode === "live" && Boolean(product?.available);
  const fields = React.useMemo(() => ORDER.filter((key) => key === "name" || key === "phone" || props.fields[key]?.enabled), [props.fields]);
  const required = (key: FormFieldKey) => key === "name" || key === "phone" || Boolean(props.fields[key]?.required);

  const [values, setValues] = React.useState<Partial<Record<FormFieldKey, string>>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [options, setOptions] = React.useState<Record<number, number>>(() => {
    const start: Record<number, number> = {};
    for (const o of product?.options ?? []) if (o.values.length === 1) start[o.id] = o.values[0].id;
    return start;
  });
  const [quantity, setQuantityState] = React.useState(1);
  const [chosenOffer, setChosenOffer] = React.useState<number | null>(null);
  const [code, setCode] = React.useState("");
  const [appliedCode, setAppliedCode] = React.useState("");
  const [company, setCompany] = React.useState<number | null>(null);
  const [quote, setQuote] = React.useState<LandingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [status, setStatus] = React.useState<Status>("idle");
  const [formError, setFormError] = React.useState<string | null>(null);
  const token = React.useRef<string | null>(null);
  const touched = React.useRef(false);
  const busy = React.useRef(false);
  const lastLead = React.useRef("");

  const offers = activeOffers(data.offers);
  const picker = props.offer_picker && offers.length > 0;
  const setQuantity = React.useCallback((n: number) => setQuantityState(Math.max(1, Math.min(20, Math.round(n) || 1))), []);

  // Anti-bot token, fetched by the browser (never baked into the cached page).
  React.useEffect(() => {
    if (!live) return;
    captureUtm();
    const controller = new AbortController();
    fetch(`/api/public/landing/form-token?slug=${encodeURIComponent(slug)}`, { signal: controller.signal, credentials: "same-origin" })
      .then((r) => r.json())
      .then((json: { data?: { token?: string } }) => {
        token.current = json.data?.token ?? null;
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [live, slug]);

  const optionsReady = (product?.options ?? []).every((o) => !o.is_required || options[o.id]);
  const phone = normalizePhone(values.phone ?? "");
  const governorate = values.governorate ?? "";

  // Live price from the server whenever something that changes it changes.
  React.useEffect(() => {
    if (!live || !optionsReady) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const response = await post("/api/public/landing/quote", { slug, quantity, options, code: appliedCode || null, phone, governorate: governorate || null, offer_id: picker ? chosenOffer : null, shipping_company_id: company }, controller.signal);
        const json = (await response.json().catch(() => ({}))) as { data?: LandingQuote };
        if (response.ok && json.data) setQuote(json.data);
      } catch {
        // Keep the last price on screen.
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [live, optionsReady, slug, quantity, options, appliedCode, phone, governorate, picker, chosenOffer, company]);

  // A valid phone typed but no order yet: the merchant can follow it up («الطلبات المتروكة»).
  const name = (values.name ?? "").trim();
  React.useEffect(() => {
    if (!live || !phone || status === "submitting") return;
    const signature = [phone, name, governorate, quantity].join("|");
    if (signature === lastLead.current) return;
    const timer = window.setTimeout(() => {
      if (!token.current) return;
      lastLead.current = signature;
      fetch("/api/public/landing/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ slug, phone, name: name || null, governorate: governorate || null, quantity, form_token: token.current }),
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [live, phone, name, governorate, quantity, status, slug]);

  const touch = React.useCallback(() => {
    if (touched.current || mode !== "live") return;
    touched.current = true;
    sendPageEvent(slug, "form_start");
    if (product) track("InitiateCheckout", { content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 });
  }, [mode, slug, product]);

  function check(key: FormFieldKey, value: string): string | null {
    const v = value.trim();
    if (!v) return required(key) ? (c.errors[key as keyof typeof c.errors] ?? ar.validation.required) : null;
    if ((key === "phone" || key === "phone2") && !isValidPhone(v)) return c.errors.phone;
    if (key === "name" && v.length < 2) return c.errors.name;
    if (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return c.errors.email;
    return null;
  }

  function setValue(key: FormFieldKey, value: string) {
    touch();
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[`customer.${key}`]) {
      const message = check(key, value);
      setErrors((current) => {
        const next = { ...current };
        if (message) next[`customer.${key}`] = message;
        else delete next[`customer.${key}`];
        return next;
      });
    }
  }

  function setOption(optionId: number, valueId: number) {
    touch();
    setOptions((current) => ({ ...current, [optionId]: valueId }));
    setErrors((current) => {
      const next = { ...current };
      delete next[`options.${optionId}`];
      return next;
    });
  }

  /** Picking an offer card also sets the quantity it needs (0 = one piece, no offer). */
  function chooseOffer(offerId: number) {
    touch();
    setChosenOffer(offerId);
    const offer = offers.find((o) => o.id === offerId);
    setQuantity(offer ? offerQuantity(offer) : 1);
  }

  function applyCode() {
    touch();
    setAppliedCode(code.trim().toUpperCase());
  }

  async function submit() {
    if (busy.current) return;
    setFormError(null);
    const next: Record<string, string> = {};
    for (const key of fields) {
      const message = check(key, values[key] ?? "");
      if (message) next[`customer.${key}`] = message;
    }
    for (const option of product?.options ?? []) {
      if (option.is_required && !options[option.id]) next[`options.${option.id}`] = t.chooseFirst(option.name);
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      document.querySelector<HTMLElement>(`[data-field="${CSS.escape(Object.keys(next)[0])}"]`)?.focus();
      return;
    }
    if (mode !== "live") {
      setFormError(t.preview);
      return;
    }
    if (!product || !product.available) return;

    busy.current = true;
    setStatus("submitting");
    const customer: Record<string, string> = {};
    for (const key of fields) {
      const value = (values[key] ?? "").trim();
      if (value) customer[key] = key === "phone" || key === "phone2" ? (normalizePhone(value) ?? value) : value;
    }
    try {
      const response = await post("/api/public/landing/orders", {
        slug,
        quantity,
        options,
        code: appliedCode || (code.trim() ? code.trim().toUpperCase() : null),
        customer,
        form_token: token.current,
        website: "",
        ab: abTestId(),
        utm: captureUtm(),
        offer_id: picker ? chosenOffer : null,
        shipping_company_id: company,
        idempotency_key: crypto.randomUUID(),
      });
      const json = (await response.json().catch(() => ({}))) as { data?: { order_number: number; total: number; upsell?: UpsellOfferData | null }; code?: string; message?: string; errors?: Record<string, string[]> };
      if (response.ok && json.data) {
        saveUpsell(json.data.order_number, json.data.upsell);
        onPlaced({ slug, number: json.data.order_number, total: json.data.total, quantity, product_id: product.id, product_name: product.name });
        return;
      }
      setStatus("error");
      if (response.status === 422 && json.errors) {
        const mapped: Record<string, string> = {};
        for (const [key, messages] of Object.entries(json.errors)) mapped[key] = messages[0] ?? "";
        setErrors(mapped);
        if (!Object.keys(mapped).some((k) => k.startsWith("customer.") || k.startsWith("options.") || k === "code")) setFormError(json.message ?? t.rejected);
      } else {
        setFormError(t.rejected);
      }
    } catch {
      setStatus("error");
      setFormError(t.network);
    } finally {
      busy.current = false;
      setStatus((s) => (s === "submitting" ? "idle" : s));
    }
  }

  return {
    fields,
    required,
    values,
    setValue,
    errors: { ...errors, ...(quote?.code_error && appliedCode ? { code: quote.code_error } : {}) } as Record<string, string>,
    options,
    setOption,
    quantity,
    setQuantity,
    offers,
    picker,
    chosenOffer: picker ? (chosenOffer ?? quote?.offer?.id ?? 0) : null,
    chooseOffer,
    code,
    setCode,
    applyCode,
    appliedCode,
    removeCode: () => {
      setAppliedCode("");
      setCode("");
    },
    company,
    setCompany,
    quote,
    quoteLoading,
    submitting: status === "submitting",
    formError,
    submit,
    touch,
    unavailable: !product || !product.available,
    unavailableGovernorates: data.shipping.enabled ? data.shipping.unavailable : [],
  };
}
