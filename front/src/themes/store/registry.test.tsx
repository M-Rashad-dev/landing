import { describe, expect, it, vi } from "vitest";
import { AsasFrame } from "./asas/asas-store";
import { ProductView } from "./asas/pages/product";
import { storeTheme } from "./registry";
import { SufiFrame } from "./sufi/sufi-store";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

describe("store theme registry", () => {
  it("gives each store its theme's frame and pages, and «أساس» for a key it doesn't know", () => {
    expect(storeTheme("sufi_store").Frame).toBe(SufiFrame);
    expect(storeTheme("asas_store").Frame).toBe(AsasFrame);
    expect(storeTheme("sufi_store").pages.Product).toBe(ProductView);
    expect(storeTheme("gone_store").Frame).toBe(AsasFrame);
    expect(storeTheme(null).Frame).toBe(AsasFrame);
  });
});
