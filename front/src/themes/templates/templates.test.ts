import { describe, expect, it } from "vitest";
import { getTheme } from "@/themes/registry";
import { SCHEMAS } from "@/themes/shared/schemas";
import { ICONS } from "@/themes/shared/icons";
import { getTemplate, TEMPLATES, templateContent } from "./index";

// Same lists the back-end checks (config/landing.php).
const FONTS = ["cairo", "tajawal", "almarai", "ibm_plex_arabic", "noto_kufi", "readex_pro"];
const RADII = ["none", "sm", "md", "lg", "full"];
const COLOR_KEYS = ["primary", "primary_foreground", "secondary", "accent", "background", "foreground", "muted", "border"];

/** WCAG relative luminance contrast of two #RRGGBB colors. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe("page templates", () => {
  it("cover every niche once with unique keys", () => {
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
    expect(TEMPLATES.map((t) => t.niche).sort()).toEqual(["beauty", "electronics", "fashion", "health", "home", "kids", "luxury"]);
  });

  it.each(TEMPLATES.map((t) => [t.key, t] as const))("%s uses valid variants, keys and limits", (_, template) => {
    const theme = getTheme(template.themeKey);
    const types = template.sections.map((s) => s.type);
    expect(types[0]).toBe("header");
    expect(types.at(-1)).toBe("footer");
    expect(types.filter((type) => type === "order_form")).toHaveLength(1);

    for (const section of template.sections) {
      expect(theme.components[section.type].variants.map((v) => v.key), `${template.key}.${section.type}`).toContain(section.variant);
      for (const key of Object.keys(section.props ?? {})) expect(SCHEMAS[section.type].defaults, `${template.key}.${section.type}.${key}`).toHaveProperty(key);
      const icons = JSON.stringify(section.props ?? {}).match(/"icon":"([a-z_]+)"/g) ?? [];
      for (const match of icons) expect(ICONS).toHaveProperty(match.slice(8, -1));
    }
    for (const type of new Set(types)) expect(types.filter((t) => t === type).length).toBeLessThanOrEqual(SCHEMAS[type].limits.max);
  });

  it.each(TEMPLATES.map((t) => [t.key, t] as const))("%s has a complete, readable look", (_, { design }) => {
    expect(Object.keys(design.colors).sort()).toEqual([...COLOR_KEYS].sort());
    for (const value of Object.values(design.colors)) expect(value).toMatch(/^#[0-9A-F]{6}$/);
    expect(FONTS).toContain(design.font_heading);
    expect(FONTS).toContain(design.font_body);
    expect(RADII).toContain(design.button_radius);
    // Button text and body text pass WCAG AA.
    expect(contrast(design.colors.primary!, design.colors.primary_foreground!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(design.colors.foreground!, design.colors.background!)).toBeGreaterThanOrEqual(7);
  });

  it("builds content with fresh ids, schema defaults under the template copy, and an optional look", () => {
    const template = getTemplate("beauty-soft")!;
    const a = templateContent(template);
    const b = templateContent(template, { withDesign: false });
    expect(a.sections).toHaveLength(template.sections.length);
    expect(new Set([...a.sections, ...b.sections].map((s) => s.id)).size).toBe(a.sections.length * 2);
    const hero = a.sections.find((s) => s.type === "hero")!;
    expect(hero.props.title).toBe("بشرة أنعم ونضارة تبان من أول أسبوع");
    expect(hero.props).toHaveProperty("overlay_opacity", SCHEMAS.hero.defaults.overlay_opacity);
    expect(a.design).toEqual(template.design);
    expect(a.design).not.toBe(template.design);
    expect(b).not.toHaveProperty("design");
    expect(getTemplate("nope")).toBeNull();
  });
});
