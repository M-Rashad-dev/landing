import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { THEME_DEMO_SCHEMES, THEME_DEMOS, THEME_SHOTS } from "./registry";
import { STORE_DEMOS } from "./store/demos";
import { STORE_THEME_KEYS } from "./store/registry";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

describe("theme gallery registry", () => {
  it("lists the same showcases as the showcase registry, each for a store theme the storefront draws", () => {
    expect([...THEME_DEMOS].sort()).toEqual(Object.keys(STORE_DEMOS).sort());
    for (const key of THEME_DEMOS) expect(STORE_THEME_KEYS).toContain(key);
    expect([...THEME_DEMO_SCHEMES].sort()).toEqual(Object.keys(STORE_DEMOS).filter((k) => STORE_DEMOS[k].schemes).sort());
  });

  it("ships every picture it lists (cover + 5 per theme)", () => {
    for (const [key, shots] of Object.entries(THEME_SHOTS)) {
      expect(shots).toHaveLength(6);
      for (const shot of shots) expect(existsSync(join(process.cwd(), "public", shot)), `${key}: ${shot}`).toBe(true);
    }
  });
});
