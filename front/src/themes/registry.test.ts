import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LANDING_DEMOS } from "./landing/demos";
import { LANDING_THEME_KEYS } from "./landing/keys";
import { LANDING_THEME_DEMOS, THEME_DEMO_SCHEMES, THEME_DEMOS, THEME_SHOTS } from "./registry";
import { STORE_DEMOS } from "./store/demos";
import { STORE_THEME_KEYS } from "./store/registry";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

describe("theme gallery registry", () => {
  it("lists the same showcases as the showcase registry, each for a store theme the storefront draws", () => {
    expect([...THEME_DEMOS].sort()).toEqual(Object.keys(STORE_DEMOS).sort());
    for (const key of THEME_DEMOS) expect(STORE_THEME_KEYS).toContain(key);
    const landing = Object.entries(LANDING_DEMOS);
    expect([...THEME_DEMO_SCHEMES].sort()).toEqual([...Object.keys(STORE_DEMOS).filter((k) => STORE_DEMOS[k].schemes), ...landing.filter(([, d]) => d.schemes).map(([k]) => k)].sort());
  });

  it("gives every landing theme a showcase page with pictures that ship", () => {
    expect([...LANDING_THEME_DEMOS].sort()).toEqual([...LANDING_THEME_KEYS].sort());
    for (const [key, demo] of Object.entries(LANDING_DEMOS)) {
      const content = demo.content();
      expect(content.sections.filter((s) => s.type === "order_form"), key).toHaveLength(1);
      expect(new Set(content.sections.map((s) => s.id)).size, key).toBe(content.sections.length);
      for (const image of Object.values(demo.data.media)) expect(existsSync(join(process.cwd(), "public", image.urls.large)), `${key}: ${image.urls.large}`).toBe(true);
    }
  });

  it("ships every picture it lists (cover + 5 per theme)", () => {
    for (const [key, shots] of Object.entries(THEME_SHOTS)) {
      expect(shots).toHaveLength(6);
      for (const shot of shots) expect(existsSync(join(process.cwd(), "public", shot)), `${key}: ${shot}`).toBe(true);
    }
  });
});
