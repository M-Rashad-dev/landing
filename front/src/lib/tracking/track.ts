/**
 * Sends one logical event to every loaded pixel (section 8 mapping).
 * Missing tools (not configured or blocked) are skipped silently.
 */
export type TrackEvent = "ViewContent" | "InitiateCheckout" | "Lead" | "Purchase";

export type TrackPayload = {
  content_ids?: Array<string | number>;
  content_name?: string;
  value?: number;
  currency?: "EGP";
  num_items?: number;
  transaction_id?: string | number;
};

type AnyFn = (...args: unknown[]) => void;
type TrackingWindow = Window & {
  fbq?: AnyFn;
  ttq?: { track?: AnyFn; page?: AnyFn };
  gtag?: AnyFn;
  snaptr?: AnyFn;
  dataLayer?: unknown[];
  /** Set by the GTM snippet: only then are events pushed to dataLayer (gtag already feeds GA4). */
  __lpGtm?: boolean;
};

const META: Record<TrackEvent, string> = { ViewContent: "ViewContent", InitiateCheckout: "InitiateCheckout", Lead: "Lead", Purchase: "Purchase" };
const TIKTOK: Record<TrackEvent, string> = { ViewContent: "ViewContent", InitiateCheckout: "InitiateCheckout", Lead: "SubmitForm", Purchase: "CompletePayment" };
const GA4: Record<TrackEvent, string> = { ViewContent: "view_item", InitiateCheckout: "begin_checkout", Lead: "generate_lead", Purchase: "purchase" };
const SNAP: Record<TrackEvent, string> = { ViewContent: "VIEW_CONTENT", InitiateCheckout: "START_CHECKOUT", Lead: "SIGN_UP", Purchase: "PURCHASE" };

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // A broken third-party script must never break the page.
  }
}

export function track(event: TrackEvent, payload: TrackPayload = {}, win: TrackingWindow | undefined = typeof window === "undefined" ? undefined : (window as TrackingWindow)): void {
  if (!win) return;
  const data = { content_type: "product", currency: "EGP", ...payload };

  if (typeof win.fbq === "function") {
    const options = payload.transaction_id ? { eventID: String(payload.transaction_id) } : undefined;
    safe(() => win.fbq!("track", META[event], data, options));
  }
  if (win.ttq && typeof win.ttq.track === "function") {
    safe(() =>
      win.ttq!.track!(TIKTOK[event], {
        content_id: payload.content_ids?.[0] !== undefined ? String(payload.content_ids[0]) : undefined,
        content_type: "product",
        content_name: payload.content_name,
        quantity: payload.num_items,
        value: payload.value,
        currency: "EGP",
      }),
    );
  }
  const ga = {
    currency: "EGP",
    value: payload.value,
    transaction_id: payload.transaction_id !== undefined ? String(payload.transaction_id) : undefined,
    items: payload.content_ids?.map((id) => ({ item_id: String(id), item_name: payload.content_name, quantity: payload.num_items ?? 1 })),
  };
  if (typeof win.gtag === "function") safe(() => win.gtag!("event", GA4[event], ga));
  if (win.__lpGtm && Array.isArray(win.dataLayer)) safe(() => win.dataLayer!.push({ event: GA4[event], ecommerce: ga }));
  if (typeof win.snaptr === "function") {
    safe(() =>
      win.snaptr!("track", SNAP[event], {
        item_ids: payload.content_ids?.map(String),
        price: payload.value,
        currency: "EGP",
        number_items: payload.num_items,
        transaction_id: payload.transaction_id !== undefined ? String(payload.transaction_id) : undefined,
      }),
    );
  }
}
