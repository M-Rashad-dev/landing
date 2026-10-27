import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getComponent, getTheme, resolveVariant, THEMES } from "@/themes/registry";
import { SafeLink } from "@/themes/shared/components/safe-link";
import { SCHEMAS } from "@/themes/shared/schemas";
import { COMPONENT_TYPES } from "@/themes/types";
import { DEMO_PROP_OVERRIDES, demoContext, DEMO_IDENTITIES } from "@/themes/dev/fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

class IO {
  observe() {}
  disconnect() {}
  unobserve() {}
}
globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver;

afterEach(cleanup);

const cases = Object.values(THEMES).flatMap((theme) =>
  COMPONENT_TYPES.flatMap((type) => theme.components[type].variants.map((variant) => [theme.key, type, variant.key] as const)),
);

describe("every component × variant renders", () => {
  it.each(cases)("%s / %s / %s with full props", (themeKey, type, variant) => {
    const def = getComponent(themeKey, type)!;
    const Component = def.component;
    const props = { ...SCHEMAS[type].defaults, ...(DEMO_PROP_OVERRIDES[type] ?? {}) };
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(<Component sectionId="11111111-2222-4333-8444-555555555555" props={props} variant={variant} ctx={demoContext()} />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it.each(cases)("%s / %s / %s with empty props and no product", (themeKey, type, variant) => {
    const Component = getComponent(themeKey, type)!.component;
    expect(() =>
      render(<Component sectionId="11111111-2222-4333-8444-555555555555" props={{}} variant={variant} ctx={demoContext(DEMO_IDENTITIES.dark, { product: null, offers: [], media: {}, isPreview: false })} />),
    ).not.toThrow();
  });
});

describe("content safety", () => {
  it("never renders javascript: links", () => {
    const { container } = render(<SafeLink href="javascript:alert(1)">x</SafeLink>);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("x");
  });

  it("opens external links safely", () => {
    const { container } = render(<SafeLink href="https://example.com">x</SafeLink>);
    expect(container.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders user text as text (no HTML injection)", () => {
    const Hero = getComponent("malak", "hero")!.component;
    const { container } = render(<Hero sectionId="x" props={{ ...SCHEMAS.hero.defaults, title: "<img src=x onerror=alert(1)>" }} variant="split" ctx={demoContext()} />);
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("registry", () => {
  it("falls back to the default variant for unknown variants", () => {
    for (const theme of Object.values(THEMES)) {
      for (const type of COMPONENT_TYPES) {
        expect(resolveVariant(theme.key, type, "does-not-exist")).toBe(getTheme(theme.key).components[type].defaultVariant);
      }
    }
  });
});
