import { describe, expect, it, vi } from "vitest";
import { validTracking } from "./ids";
import { PIXEL_KEYS, pixelSnippet } from "./snippets";
import { track } from "./track";

function fakeWindow(withGtm = false) {
  return {
    fbq: vi.fn(),
    ttq: { track: vi.fn(), page: vi.fn() },
    gtag: vi.fn(),
    snaptr: vi.fn(),
    dataLayer: [] as unknown[],
    __lpGtm: withGtm,
  };
}

const payload = { content_ids: [7], content_name: "ساعة", value: 450, num_items: 2, transaction_id: 1001 };

describe("track()", () => {
  it("maps one event to every tool", () => {
    const win = fakeWindow(true);
    track("Purchase", payload, win as unknown as Window);

    expect(win.fbq).toHaveBeenCalledWith("track", "Purchase", expect.objectContaining({ content_ids: [7], currency: "EGP", content_type: "product", value: 450 }), { eventID: "1001" });
    expect(win.ttq.track).toHaveBeenCalledWith("CompletePayment", expect.objectContaining({ content_id: "7", quantity: 2, currency: "EGP", value: 450 }));
    expect(win.gtag).toHaveBeenCalledWith("event", "purchase", expect.objectContaining({ transaction_id: "1001", value: 450, items: [{ item_id: "7", item_name: "ساعة", quantity: 2 }] }));
    expect(win.dataLayer).toEqual([expect.objectContaining({ event: "purchase" })]);
    expect(win.snaptr).toHaveBeenCalledWith("track", "PURCHASE", expect.objectContaining({ item_ids: ["7"], transaction_id: "1001" }));
  });

  it("uses the event table names", () => {
    const cases = [
      ["ViewContent", "ViewContent", "ViewContent", "view_item", "VIEW_CONTENT"],
      ["InitiateCheckout", "InitiateCheckout", "InitiateCheckout", "begin_checkout", "START_CHECKOUT"],
      ["Lead", "Lead", "SubmitForm", "generate_lead", "SIGN_UP"],
    ] as const;
    for (const [event, meta, tiktok, ga, snap] of cases) {
      const win = fakeWindow();
      track(event, payload, win as unknown as Window);
      expect(win.fbq.mock.calls[0][1]).toBe(meta);
      expect(win.ttq.track.mock.calls[0][0]).toBe(tiktok);
      expect(win.gtag.mock.calls[0][1]).toBe(ga);
      expect(win.snaptr.mock.calls[0][1]).toBe(snap);
    }
  });

  it("pushes to dataLayer only when GTM is loaded", () => {
    const win = fakeWindow(false);
    track("Lead", payload, win as unknown as Window);
    expect(win.dataLayer).toEqual([]);
  });

  it("ignores missing or broken tools silently", () => {
    expect(() => track("Lead", payload, {} as Window)).not.toThrow();
    const win = {
      fbq: () => {
        throw new Error("blocked");
      },
      gtag: vi.fn(),
    };
    expect(() => track("Lead", payload, win as unknown as Window)).not.toThrow();
    expect(win.gtag).toHaveBeenCalled();
    expect(() => track("Lead", payload, undefined)).not.toThrow();
  });
});

describe("pixel snippets", () => {
  it("only valid ids get a snippet, inserted as JSON strings", () => {
    const ids = validTracking({ meta_pixel_id: "1234567890", ga4_id: "g-abc1234", tiktok_pixel_id: "');alert(1);//", gtm_id: null });
    expect(PIXEL_KEYS.filter((key) => ids[key])).toEqual(["meta_pixel_id", "ga4_id"]);
    expect(pixelSnippet("meta_pixel_id", ids.meta_pixel_id!)).toContain(`fbq('init',"1234567890")`);
    expect(pixelSnippet("ga4_id", ids.ga4_id!)).toContain(`gtag('config',"G-ABC1234")`);
  });
});
