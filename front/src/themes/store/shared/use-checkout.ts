"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { formatPhoneLocal, normalizePhone } from "@/lib/phone";
import { useAccount, type Address } from "@/lib/store/account";
import { cartPayload, clearCart, useCart } from "@/lib/store/cart";
import { cartToken, resetCartToken, sendStoreEvent } from "@/lib/store/events";
import { applyRecovered, fetchRecovered, recoveryToken } from "@/lib/store/recovery";
import { GOVERNORATES } from "@/lib/store/governorates";
import { useCartQuote, type QuoteState } from "@/lib/store/quote";
import type { StoreConfig } from "@/lib/store/types";
import { saveUpsell, type UpsellOfferData } from "@/lib/store/upsell";
import { track } from "@/lib/tracking/track";
import { captureUtm } from "@/lib/tracking/utm";
import { ar } from "@/messages/ar";
import { defaultPayment } from "@/themes/shared/payment-choice";
import type { ReceiptDraft } from "@/themes/shared/receipt-upload";
import { clearCartNote, readCartNote } from "./cart-note";

const t = ar.storefront.checkout;

const base = z.object({
  name: z.string().trim().min(2, t.errors.name).max(80, t.errors.name),
  phone: z.string().trim().refine((v) => normalizePhone(v) !== null, t.errors.phone),
  governorate: z.string().refine((v) => (GOVERNORATES as readonly string[]).includes(v), t.errors.governorate),
  city: z.string().trim().max(100),
  address: z.string().trim().min(5, t.errors.address).max(300, t.errors.address),
  notes: z.string().trim().max(500),
  email: z
    .string()
    .trim()
    .max(191, t.errors.email)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), t.errors.email),
  website: z.string().max(200),
});
export type CheckoutValues = z.infer<typeof base>;

/** Digital products need the email; with nothing physical there is no address to ask for. */
function schemaFor(digital: boolean, allDigital: boolean) {
  const shape = allDigital ? base.extend({ governorate: z.string(), address: z.string().max(300) }) : base;
  return digital ? shape.extend({ email: z.string().trim().max(191, t.errors.email).refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), t.errors.emailDigital) }) : shape;
}
const FIELDS = ["name", "phone", "email", "governorate", "city", "address", "notes"] as const;

/**
 * Everything the checkout does, whatever it looks like: the form and its rules, the signed-in
 * customer's saved addresses, the live quote (code, shipping company), the anti-bot token, the
 * abandoned-checkout lead, placing the order and the pixels. The page only draws it.
 */
export function useCheckout(config: StoreConfig) {
  const cart = useCart();
  const router = useRouter();
  const digital = cart.items.some((i) => i.digital);
  const allDigital = digital && cart.items.every((i) => i.digital);
  // The rules follow the cart (read when the form validates).
  const rules = React.useRef(schemaFor(digital, allDigital));
  React.useEffect(() => {
    rules.current = schemaFor(digital, allDigital);
  }, [digital, allDigital]);
  const form = useForm<CheckoutValues>({ resolver: (values, context, options) => zodResolver(rules.current)(values, context, options), defaultValues: { name: "", phone: "", email: "", governorate: "", city: "", address: "", notes: "", website: "" }, mode: "onTouched" });
  const { handleSubmit, setError, control } = form;
  const governorate = useWatch({ control, name: "governorate" });
  const phone = normalizePhone(useWatch({ control, name: "phone" }));
  const name = useWatch({ control, name: "name" });
  const email = useWatch({ control, name: "email" });

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
  // Cash on delivery or one of the store's prepaid methods.
  // A cart with digital products is paid first: no cash on delivery.
  const paymentOptions = config.payments && digital ? { ...config.payments, cod: false } : config.payments;
  const [payment, setPaymentState] = React.useState(() => defaultPayment(paymentOptions));
  if (digital && payment === "cod" && paymentOptions && paymentOptions.methods.length) setPaymentState(String(paymentOptions.methods[0].id));
  const [paymentError, setPaymentError] = React.useState<string | null>(null);
  const setPayment = (v: string) => {
    setPaymentState(v);
    setPaymentError(null);
    setReceiptError(null);
  };
  // A transfer (InstaPay, wallet, bank, link): its receipt is picked right under it and sent with the order.
  const transfer = paymentOptions?.methods.find((m) => String(m.id) === payment && m.kind !== "online") ?? null;
  const [receipt, setReceiptState] = React.useState<ReceiptDraft>({ file: null, sender: "" });
  const [receiptError, setReceiptError] = React.useState<string | null>(null);
  const setReceipt = (d: ReceiptDraft) => {
    setReceiptState(d);
    if (d.file) setReceiptError(null);
  };
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

  // A cart reminder's link (?r=…): the left cart comes back with the customer's details.
  React.useEffect(() => {
    const token = recoveryToken(window.location.search);
    if (!token) return;
    let alive = true;
    void fetchRecovered(token).then((data) => {
      if (!alive || !data) return;
      applyRecovered(data);
      const put = (field: "name" | "phone" | "email", value: string | null) => {
        if (value && !String(form.getValues(field) ?? "").trim()) form.setValue(field, value, { shouldDirty: true });
      };
      put("name", data.customer.name);
      put("phone", data.customer.phone ? formatPhoneLocal(data.customer.phone) : null);
      put("email", data.customer.email);
    });
    return () => {
      alive = false;
    };
  }, [form]);

  // A note written in the cart («ملاحظات للمطبخ») starts the checkout's notes.
  React.useEffect(() => {
    const note = readCartNote();
    if (note && !form.getValues("notes")) form.setValue("notes", note);
  }, [form]);

  React.useEffect(() => {
    if (!me || filled.current) return;
    filled.current = true;
    form.setValue("phone", formatPhoneLocal(me.phone));
    if (me.email && !form.getValues("email")) form.setValue("email", me.email);
    if (me.name && !form.getValues("name")) form.setValue("name", me.name);
    if (preferred) fillAddress(preferred, true);
  }, [me, form, fillAddress, preferred]);

  const quote = useCartQuote(cart, { code, governorate: governorate || null, phone, shipping_company_id: companyId });
  const shown: QuoteState = { ...quote, lineErrors: { ...quote.lineErrors, ...lineErrors } };
  const shippingOn = config.shipping.enabled && !allDigital;

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
        body: JSON.stringify({ items: JSON.parse(items), phone, name: name.trim() || null, email: email.trim() || null, governorate: governorate || null, form_token: token, cart_token: cartToken() || null }),
        keepalive: true,
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [phone, token, items, name, email, governorate]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    setLineErrors({});
    if (transfer && !receipt.file) {
      setReceiptError(ar.storefront.pay.receiptRequired);
      document.getElementById("pay-receipt")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    setPlacing(true);
    try {
      const response = await fetch("/api/public/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: cartPayload(cart),
          customer: { name: values.name, phone: values.phone, governorate: values.governorate || null, city: values.city || null, address: values.address || null, notes: values.notes || null, email: values.email || null },
          code,
          shipping_company_id: shippingOn ? (companyId ?? quote.quote?.shipping_company?.id ?? null) : null,
          form_token: token,
          website: values.website,
          utm: captureUtm(),
          cart_token: cartToken() || null,
          save_address: me !== null && addressId === "new" && keepAddress,
          payment_method: payment,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { data?: { order_number: number; total: number; upsell?: UpsellOfferData | null; pay_url?: string | null }; errors?: Record<string, string[]>; message?: string };
      if (response.ok && json.data) {
        track("Purchase", { content_ids: cart.items.map((i) => i.product_id), value: json.data.total, num_items: cart.items.reduce((s, i) => s + i.quantity, 0), transaction_id: json.data.order_number });
        clearCart();
        clearCartNote();
        resetCartToken();
        saveUpsell(json.data.order_number, json.data.upsell);
        // A prepaid order: «طلبك وصل» shows «ادفع وارفع الإيصال» (its private token), or that the receipt arrived.
        const pay = json.data.pay_url?.match(/\/pay\/([a-z0-9]{12})$/)?.[1];
        const sent = pay && transfer && receipt.file ? await sendReceipt(pay, transfer.id, receipt) : null;
        router.replace(`/checkout/done?order=${json.data.order_number}&total=${json.data.total}${pay ? `&pay=${pay}` : ""}${sent === null ? "" : `&receipt=${sent ? "sent" : "failed"}`}`);
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
        if (json.errors.payment_method?.[0]) setPaymentError(json.errors.payment_method[0]);
        const other = json.errors.code?.[0] ?? json.errors.shipping_company_id?.[0] ?? json.errors.payment_method?.[0] ?? (Object.keys(lines).length ? t.errors.cart : null);
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

  return {
    cart,
    paymentOptions,
    /** Something physical to ship (the address is asked); digital lines need the email. */
    needsAddress: !allDigital,
    emailRequired: digital,
    payment,
    setPayment,
    paymentError,
    form,
    submit,
    governorate,
    /** The signed-in customer (null: a guest), and the account query for its states. */
    me,
    account,
    addressId,
    pickAddress,
    keepAddress,
    setKeepAddress,
    /** The chosen transfer method (null: cash on delivery or online) and its receipt. */
    transfer,
    receipt,
    setReceipt,
    receiptError,
    /** The discount code: what is typed, what is applied. */
    codeInput,
    setCodeInput,
    code,
    applyCode: () => setCode(codeInput.trim().toUpperCase() || null),
    removeCode: () => {
      setCode(null);
      setCodeInput("");
    },
    /** The server's price for the cart (`shown` adds the order's own line errors). */
    quote,
    shown,
    shippingOn,
    selectedCompany: companyId ?? quote.quote?.shipping_company?.id ?? null,
    setCompanyId,
    failure,
    placing,
    /** False until the anti-bot token arrives: the order can't be sent before. */
    ready: token !== null,
  };
}

/** The receipt picked at checkout goes to the new order's pay page. False when it didn't make it (sent again from there). */
async function sendReceipt(token: string, methodId: number, draft: ReceiptDraft): Promise<boolean> {
  if (!draft.file) return false;
  const form = new FormData();
  form.set("token", token);
  form.set("method_id", String(methodId));
  if (draft.sender.trim()) form.set("sender_ref", draft.sender.trim());
  form.set("receipt", draft.file, draft.file.name);
  try {
    const response = await fetch("/api/public/payments", { method: "POST", body: form, headers: { Accept: "application/json" } });
    return response.ok;
  } catch {
    return false;
  }
}
