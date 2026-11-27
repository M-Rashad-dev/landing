import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { LANDING_BUILDER_THEMES } from "@/features/landings/themes";
import { LANDING_DEMOS } from "../demos";
import { RAWAQ_LANDING_DEMO_DATA, rawaqLandingDemoContent } from "./demo";
import { RawaqLandingPage } from "./page";
import type { RawaqLandingContent } from "./types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/serum", useSearchParams: () => new URLSearchParams() }));

const t = ar.rawaqLanding;
const content = rawaqLandingDemoContent() as unknown as RawaqLandingContent;
const data = RAWAQ_LANDING_DEMO_DATA;

beforeEach(() => {
  push.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (url.startsWith("/api/public/landing/form-token")) return Response.json({ data: { token: "tok" } });
      if (url === "/api/public/landing/quote") return Response.json({ data: { unit_price: 450, quantity: body.quantity, base_subtotal: 450 * body.quantity, offer: null, subtotal_after_offer: 450 * body.quantity, code: null, code_error: null, shipping: null, total: 450 * body.quantity } });
      return new Response(null, { status: 202 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("«رواق · صفحة هبوط»", () => {
  it("draws its beauty sections: the colored word, price and rating, benefits, ingredients, steps, who it suits", () => {
    const { container } = render(<RawaqLandingPage content={content} data={data} mode="preview" />);
    expect(container.querySelector(".rl-root")).not.toBeNull();
    expect(container.querySelector("h1 em")?.textContent).toBe("منوّرة");
    expect(screen.getAllByText(formatMoney(450)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.off(25))).toHaveLength(2);
    expect(screen.getByText(t.ratingLine(4.7, 3))).toBeInTheDocument();
    for (const text of ["توحيد اللون", "فيتامين C 15%", "FA", "3 نقط بس", "البقع والتصبّغات", "خصم 25%", "بيوصلك مقفول", "لو بشرتك حساسة، ابدئي يوم ويوم أول أسبوع."]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(t.countdown.left(14))).toBeInTheDocument();
  });

  it("slides between before and after", () => {
    const { container } = render(<RawaqLandingPage content={content} data={data} mode="preview" />);
    const slider = screen.getByRole("slider", { name: t.beforeAfter.drag });
    fireEvent.change(slider, { target: { value: "80" } });
    expect((container.querySelector('[style*="clip-path"]') as HTMLElement).style.clipPath).toBe("inset(0 0 0 20%)");
  });

  it("makes a card per running offer and picks it in the order form", async () => {
    render(<RawaqLandingPage content={content} data={data} mode="preview" />);
    const cards = screen.getByRole("heading", { name: "اختاري العرض اللي يناسبك" }).closest("section")!;
    expect(within(cards).getByText(formatMoney(820))).toBeInTheDocument();
    const picks = within(cards).getAllByRole("button", { name: t.bundles.choose });
    fireEvent.click(picks[picks.length - 1]!);
    await waitFor(() => expect(screen.getByRole("radio", { name: /عبوتين بسعر خاص/ })).toHaveAttribute("aria-checked", "true"));
  });

  it("hides an empty countdown and a before/after without pictures on the live page, and tells the Builder why", () => {
    const quiet = { ...data, product: { ...data.product!, stock_mode: "unlimited" as const, stock: null } };
    const empty: RawaqLandingContent = {
      ...content,
      sections: content.sections.map((s) => (s.type === "countdown" ? { ...s, props: { ...s.props, ends_at: "2000-01-01T00:00:00Z" } } : s.type === "before_after" ? { ...s, props: { ...s.props, before_media_id: null } } : s)),
    };
    const { unmount } = render(<RawaqLandingPage content={empty} data={quiet} mode="live" />);
    expect(screen.queryByText("الخصم بيخلص قريب")).toBeNull();
    expect(screen.queryByText(t.beforeAfter.empty)).toBeNull();
    unmount();
    render(<RawaqLandingPage content={empty} data={quiet} mode="builder" />);
    expect(screen.getByText(t.countdown.builderHint)).toBeInTheDocument();
    expect(screen.getByText(t.beforeAfter.empty)).toBeInTheDocument();
  });

  it("is in the showcases and the Builder, with every section addable", () => {
    expect(LANDING_DEMOS.rawaq_landing.schemes).toBe(false);
    const theme = LANDING_BUILDER_THEMES.rawaq_landing;
    expect(theme.addable).toEqual(expect.arrayContaining(["benefits", "before_after", "ingredients", "how_to", "suits", "trust"]));
    for (const type of theme.addable) {
      const section = theme.newSection(type, "سيروم");
      render(<RawaqLandingPage content={{ ...content, sections: [section as unknown as RawaqLandingContent["sections"][number]] }} data={data} mode="builder" />);
      cleanup();
    }
  });
});
