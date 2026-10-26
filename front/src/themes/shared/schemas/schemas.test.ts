import { describe, expect, it } from "vitest";
import { getComponent, getTheme, resolveVariant, THEMES } from "@/themes/registry";
import { COMPONENT_TYPES, type FieldDef } from "@/themes/types";
import { SCHEMAS } from "./index";

/** Naming rules the back-end sanitizer relies on (section 6). */
const SUFFIX: Partial<Record<FieldDef["type"], string>> = {
  color: "_color",
  image: "_media_id",
  images: "_media_ids",
  link: "_url",
  icon: "_icon",
};

function checkFields(fields: FieldDef[], path: string) {
  for (const field of fields) {
    expect(field.key, `${path}.${field.key}`).toMatch(/^[a-z][a-z0-9_]{0,59}$/);
    const suffix = SUFFIX[field.type];
    // Icons are stored under plain "icon" keys inside repeaters, which is allowed.
    if (suffix && !(field.type === "icon" && field.key === "icon")) {
      expect(field.key.endsWith(suffix), `${path}.${field.key} must end with ${suffix}`).toBe(true);
    }
    if (field.type === "repeater" || field.type === "group") checkFields(field.fields, `${path}.${field.key}`);
  }
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      keys.push(key);
      collectKeys(inner, keys);
    }
  }
  return keys;
}

describe("schemas", () => {
  it("defines a schema for every component type", () => {
    expect(Object.keys(SCHEMAS).sort()).toEqual([...COMPONENT_TYPES].sort());
  });

  it.each(COMPONENT_TYPES)("%s follows the naming rules", (type) => {
    checkFields(SCHEMAS[type].fields, type);
  });

  it.each(COMPONENT_TYPES)("%s defaults only use valid keys and match the fields", (type) => {
    const schema = SCHEMAS[type];
    for (const key of collectKeys(schema.defaults)) expect(key).toMatch(/^[a-z][a-z0-9_]{0,59}$/);
    for (const field of schema.fields) expect(schema.defaults, `${type}.${field.key}`).toHaveProperty(field.key);
    // Links in defaults must already be safe.
    expect(JSON.stringify(schema.defaults)).not.toMatch(/javascript:|data:/i);
  });

  it("marks header/footer as pinned singletons and order_form as unique", () => {
    expect(SCHEMAS.header.limits).toMatchObject({ max: 1, singleton: true, pinned: "top" });
    expect(SCHEMAS.footer.limits).toMatchObject({ max: 1, singleton: true, pinned: "bottom" });
    expect(SCHEMAS.order_form.limits.max).toBe(1);
  });
});

describe("registry", () => {
  it("registers both themes with every type, ≥2 variants and a valid default", () => {
    for (const theme of Object.values(THEMES)) {
      for (const type of COMPONENT_TYPES) {
        const def = theme.components[type];
        expect(def.variants.length).toBeGreaterThanOrEqual(2);
        expect(def.variants.map((v) => v.key)).toContain(def.defaultVariant);
      }
    }
  });

  it("falls back safely", () => {
    expect(getTheme("unknown").key).toBe("malak");
    expect(getComponent("malak", "not-a-type")).toBeNull();
    expect(resolveVariant("celia", "hero", "split")).toBe("big-type");
    expect(resolveVariant("celia", "hero", "full-cover")).toBe("full-cover");
  });
});
