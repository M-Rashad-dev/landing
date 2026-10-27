import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTheme, THEMES } from "@/themes/registry";
import { SCHEMAS } from "@/themes/shared/schemas";
import { SiteRenderer } from "@/themes/site-renderer";
import { COMPONENT_TYPES, type Section } from "@/themes/types";
import { DEMO_PROP_OVERRIDES, demoContext } from "@/themes/dev/fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
globalThis.IntersectionObserver = class {
  observe() {}
  disconnect() {}
  unobserve() {}
} as unknown as typeof IntersectionObserver;

afterEach(cleanup);

describe("theme parity", () => {
  it("both themes implement every component with ≥2 variants, a valid default and a thumbnail", () => {
    for (const theme of Object.values(THEMES)) {
      for (const type of COMPONENT_TYPES) {
        const def = theme.components[type];
        expect(def.component, `${theme.key}.${type}`).toBeTypeOf("function");
        expect(def.variants.length).toBeGreaterThanOrEqual(2);
        expect(def.variants.map((v) => v.key)).toContain(def.defaultVariant);
        expect(def.Thumbnail).toBeTypeOf("function");
      }
      expect(theme.starterSections.map((s) => s.type)).toEqual([...COMPONENT_TYPES]);
    }
  });

  it("the real themes no longer use the fallback placeholders", () => {
    for (const theme of Object.values(THEMES)) {
      for (const type of COMPONENT_TYPES) {
        expect(theme.components[type].component.displayName ?? "").not.toMatch(/^Fallback/);
      }
    }
  });

  it("switching malak ⇄ celia keeps every text and image of a fully filled page", () => {
    const sections: Section[] = COMPONENT_TYPES.map((type, i) => ({
      id: `0000000${i}-0000-4000-8000-000000000000`,
      type,
      variant: "",
      visible: true,
      props: {
        ...SCHEMAS[type].defaults,
        ...(DEMO_PROP_OVERRIDES[type] ?? {}),
        ...(type === "faq" ? { allow_multiple: true } : {}),
        ...(type === "offers" ? { empty_behavior: "message" } : {}),
      },
    }));
    // Text that must survive any theme: titles, items, questions, answers, testimonials.
    const expected = [
      SCHEMAS.hero.defaults.title,
      SCHEMAS.hero.defaults.subtitle,
      SCHEMAS.features.defaults.title,
      SCHEMAS.faq.defaults.title,
      ...(SCHEMAS.faq.defaults.items as Array<{ question: string; answer: string }>).flatMap((item) => [item.question, item.answer]),
      ...(DEMO_PROP_OVERRIDES.testimonials.items as Array<{ name: string }>).map((item) => item.name),
      ...(DEMO_PROP_OVERRIDES.features.items as Array<{ title: string }>).map((item) => item.title),
      SCHEMAS.order_form.defaults.title,
      SCHEMAS.footer.defaults.about,
      SCHEMAS.gallery.defaults.title,
    ] as string[];

    const imagesFor = (themeKey: string) => {
      const ctx = demoContext();
      const { container } = render(<SiteRenderer themeKey={themeKey} sections={sections} ctx={ctx} />);
      const text = container.textContent ?? "";
      for (const value of expected) expect(text, `${themeKey}: "${value.slice(0, 30)}"`).toContain(value);
      const srcs = new Set(Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src")));
      cleanup();
      return srcs;
    };

    const malak = imagesFor("malak");
    const celia = imagesFor("celia");
    // The same media appear in both themes.
    for (const src of malak) expect(celia.has(src), `celia is missing an image used by malak`).toBe(true);
    expect(getTheme("celia").key).toBe("celia");
  });
});
