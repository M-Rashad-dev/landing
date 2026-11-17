import { describe, expect, it, vi } from "vitest";
import { STORE_THEME_KEYS } from "@/themes/store/registry";
import { BUILDER_THEMES } from ".";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

describe("Builder theme registry", () => {
  it("knows every store theme the storefront draws, each with the base settings groups", () => {
    expect(Object.keys(BUILDER_THEMES).sort()).toEqual([...STORE_THEME_KEYS].sort());
    for (const theme of Object.values(BUILDER_THEMES)) {
      expect(theme.groups.map((g) => g.key)).toEqual(expect.arrayContaining(["look", "header", "footer", "general"]));
    }
  });
});
