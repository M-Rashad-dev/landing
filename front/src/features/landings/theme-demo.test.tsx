import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import { LandingThemeDemo } from "./theme-demo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/marketing/landings/themes/sufi_landing/demo", useSearchParams: () => new URLSearchParams() }));

const b = ar.landings.theme.demoBar;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { key: "sufi_landing", name: "صوفي", is_free: false, owned: false } })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = (key: "sufi_landing" | "shabe_landing") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LandingThemeDemo themeKey={key} />
    </QueryClientProvider>,
  );

describe("landing theme showcase", () => {
  it("opens on the phone, switches to the computer, and to dark for themes that have it", async () => {
    const { container } = show("sufi_landing");
    const frame = () => container.querySelector("[data-device]") as HTMLElement;
    expect(frame()).toHaveAttribute("data-device", "mobile");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("شنطة جلد طبيعي تعيش معاكي سنين");

    fireEvent.click(screen.getByRole("button", { name: b.desktop }));
    expect(frame()).toHaveAttribute("data-device", "desktop");

    expect(container.querySelector(".sl-root")).toHaveAttribute("data-scheme", "light");
    fireEvent.click(screen.getByRole("button", { name: b.dark }));
    expect(container.querySelector(".sl-root")).toHaveAttribute("data-scheme", "dark");
    expect(await screen.findByRole("link", { name: ar.landings.theme.buy })).toHaveAttribute("href", "/dashboard/settings/billing/checkout?theme=sufi_landing");
  });

  it("has no dark switch for a theme without dark mode", () => {
    show("shabe_landing");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("بوكس مشويات شابع يكفّي العيلة ويزيد");
    expect(screen.queryByRole("button", { name: b.dark })).toBeNull();
  });
});
