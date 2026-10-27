"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizePhone } from "@/lib/format/phone";
import { estimateQuote } from "@/lib/price/estimate";
import { track } from "@/lib/tracking/track";
import { captureUtm } from "@/lib/tracking/utm";
import type { Quote } from "@/lib/types";
import { buildFields, validateAll, validateField } from "@/themes/shared/order-form/fields";
import type { OrderFormProps } from "@/themes/shared/schemas/order-form";
import type { PageContext } from "@/themes/types";
import { siteMessages } from "@/messages/site";
import { useOfferStore } from "./offer-store";
import type { OrderFormState, OrderFormStatus } from "./order-form-types";

const QUOTE_DEBOUNCE = 300;

type ApiBody = { data?: unknown; message?: string; code?: string; errors?: Record<string, string[]> };

async function postJson(url: string, body: unknown): Promise<{ status: number; json: ApiBody }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const json = (await response.json().catch(() => ({}))) as ApiBody;
  return { status: response.status, json };
}

/**
 * All behaviour of the public order form (both themes render on top of it):
 * dynamic fields + validation, options, quantity, code, live server quote with a local
 * estimate meanwhile, anti-bot token, double-submit protection, success + conversion event.
 * In the Builder preview nothing is sent.
 */

/** sessionStorage key shared with the /track page. */
export const TRACK_PHONE_KEY = "lp_track_phone";
export function useOrderForm(props: OrderFormProps, ctx: PageContext): OrderFormState {
  const product = ctx.product;
  const fields = useMemo(() => buildFields(props), [props]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<number, number>>({});
  const [quantity, setQuantityState] = useState(1);
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [serverQuote, setServerQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [status, setStatus] = useState<OrderFormStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const token = useRef<string | null>(null);
  const touched = useRef(false);
  const submitting = useRef(false);

  const disabledReason = !product || !product.available ? siteMessages.unavailable : null;
  const live = !ctx.isPreview && !disabledReason;

  const setQuantity = useCallback((next: number) => setQuantityState(Math.max(1, Math.min(20, Math.round(next) || 1))), []);

  // Bundle cards elsewhere on the page set the quantity.
  useEffect(
    () =>
      useOfferStore.subscribe((state, previous) => {
        if (state.nonce !== previous.nonce && state.requestedQuantity) setQuantity(state.requestedQuantity);
      }),
    [setQuantity],
  );

  // Anti-bot form token (fetched by the browser, never cached in the HTML) + UTM capture.
  useEffect(() => {
    if (!live) return;
    captureUtm();
    const controller = new AbortController();
    fetch(`/api/public/form-token?slug=${encodeURIComponent(ctx.page.slug)}`, { signal: controller.signal, credentials: "same-origin" })
      .then((r) => r.json())
      .then((json: { data?: { token?: string } }) => {
        token.current = json.data?.token ?? null;
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [live, ctx.page.slug]);

  const requiredChosen = (product?.options ?? []).every((o) => !o.is_required || options[o.id]);
  const phone = typeof values["customer.phone"] === "string" ? normalizePhone(values["customer.phone"] as string) : null;

  // Live server quote (debounced) whenever what affects the price changes.
  useEffect(() => {
    if (!live || !requiredChosen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const response = await fetch("/api/public/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ slug: ctx.page.slug, quantity, options, code: appliedCode || null, phone }),
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => ({}))) as ApiBody;
        if (response.ok) setServerQuote(json.data as Quote);
      } catch {
        // Keep showing the local estimate.
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false);
      }
    }, QUOTE_DEBOUNCE);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [live, requiredChosen, ctx.page.slug, quantity, options, appliedCode, phone]);

  const estimate = useMemo(() => (product ? estimateQuote(product, ctx.offers, quantity, options) : null), [product, ctx.offers, quantity, options]);
  const quoteMatches = serverQuote && serverQuote.quantity === quantity;
  const quote = quoteMatches ? serverQuote : estimate;

  const touch = useCallback(() => {
    if (touched.current || ctx.isPreview) return;
    touched.current = true;
    if (product) track("InitiateCheckout", { content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 });
  }, [ctx.isPreview, product]);

  const setValue = useCallback(
    (name: string, value: string | boolean) => {
      touch();
      setValues((current) => ({ ...current, [name]: value }));
      setErrors((current) => {
        if (!current[name]) return current;
        const field = fields.find((f) => f.name === name);
        const message = field ? validateField(field, value) : null;
        const next = { ...current };
        if (message) next[name] = message;
        else delete next[name];
        return next;
      });
    },
    [fields, touch],
  );

  const setOption = useCallback(
    (optionId: number, valueId: number) => {
      touch();
      setOptions((current) => ({ ...current, [optionId]: valueId }));
      setErrors((current) => {
        const next = { ...current };
        delete next[`options.${optionId}`];
        return next;
      });
    },
    [touch],
  );

  const applyCode = useCallback(() => {
    touch();
    setAppliedCode(code.trim().toUpperCase());
    setErrors((current) => {
      const next = { ...current };
      delete next.code;
      return next;
    });
  }, [code, touch]);

  const submit = useCallback(async () => {
    if (submitting.current || status === "success") return;
    setFormError(null);

    const nextErrors = validateAll(fields, values);
    for (const option of product?.options ?? []) {
      if (option.is_required && !options[option.id]) nextErrors[`options.${option.id}`] = siteMessages.chooseOption(option.name);
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0];
      document.querySelector<HTMLElement>(`[data-field="${CSS.escape(first)}"]`)?.focus();
      return;
    }
    if (ctx.isPreview) {
      setFormError(siteMessages.previewMode);
      return;
    }
    if (disabledReason || !product) return;

    submitting.current = true;
    setStatus("submitting");
    const customer: Record<string, string> = {};
    const answers: Record<string, string | boolean> = {};
    for (const field of fields) {
      const value = values[field.name];
      if (value === undefined || value === "") continue;
      const [group, key] = field.name.split(".");
      if (group === "customer") customer[key] = field.kind === "tel" ? (normalizePhone(String(value)) ?? String(value)) : String(value).trim();
      else answers[key] = typeof value === "string" ? value.trim() : value;
    }

    try {
      const { status: httpStatus, json } = await postJson("/api/public/orders", {
        slug: ctx.page.slug,
        quantity,
        options,
        code: appliedCode || (code.trim() ? code.trim().toUpperCase() : null),
        customer,
        answers,
        form_token: token.current,
        website: "",
        utm: captureUtm(),
        idempotency_key: crypto.randomUUID(),
      });

      if (httpStatus >= 200 && httpStatus < 300) {
        const data = json.data as { order_number: number; total: number };
        setOrderNumber(data.order_number);
        setStatus("success");
        // Lets /track open with the phone already filled in this tab.
        try {
          window.sessionStorage.setItem(TRACK_PHONE_KEY, String(customer.phone ?? ""));
        } catch {
          // Storage blocked: the customer types the phone.
        }
        const flag = `lp_conv_${data.order_number}`;
        let alreadyTracked = false;
        try {
          alreadyTracked = window.sessionStorage.getItem(flag) === "1";
          window.sessionStorage.setItem(flag, "1");
        } catch {
          // Storage may be blocked; still track once in this session.
        }
        if (!alreadyTracked) {
          track(ctx.conversionEvent ?? "Lead", { content_ids: [product.id], content_name: product.name, value: data.total, num_items: quantity, transaction_id: data.order_number });
        }
        return;
      }

      setStatus("error");
      if (httpStatus === 422 && json.code === "validation_failed" && json.errors) {
        const mapped: Record<string, string> = {};
        for (const [key, messages] of Object.entries(json.errors)) mapped[key] = messages[0] ?? "";
        setErrors(mapped);
        if (!Object.keys(mapped).some((k) => k.startsWith("customer.") || k.startsWith("answers.") || k.startsWith("options.") || k === "code")) setFormError(json.message ?? siteMessages.rejected);
      } else {
        setFormError(json.code === "rejected" || httpStatus === 429 ? siteMessages.rejected : (json.message ?? siteMessages.rejected));
      }
    } catch {
      setStatus("error");
      setFormError(siteMessages.networkError);
    } finally {
      submitting.current = false;
    }
  }, [appliedCode, code, ctx.conversionEvent, ctx.isPreview, ctx.page.slug, disabledReason, fields, options, product, quantity, status, values]);

  return {
    fields,
    values,
    setValue,
    errors: { ...errors, ...(quote?.code_error && appliedCode && quoteMatches ? { code: quote.code_error } : {}) },
    options,
    setOption,
    quantity,
    setQuantity,
    code,
    setCode,
    applyCode,
    quote,
    quoteLoading,
    status,
    formError,
    orderNumber,
    submit,
    touch,
    disabled: Boolean(disabledReason),
    disabledReason,
  };
}
