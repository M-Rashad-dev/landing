import { describe, expect, it } from "vitest";
import { applyPageDesign, designFromIdentity } from "./page-design";

const identity = {
  brand_name: "متجر",
  colors: { primary: "#7C3AED", primary_foreground: "#FFFFFF", secondary: "#F5F3FF", accent: "#F59E0B", background: "#FFFFFF", foreground: "#1F2937", muted: "#6B7280", border: "#E5E7EB" },
  font_heading: "cairo",
  font_body: "cairo",
  button_radius: "md" as const,
};

describe("page design", () => {
  it("keeps the identity when the page has no design", () => {
    expect(applyPageDesign(identity, undefined)).toBe(identity);
  });

  it("replaces colors, fonts and radius, and keeps everything else", () => {
    const merged = applyPageDesign(identity, { colors: { primary: "#fde047", background: "#000000" }, font_heading: "readex_pro", font_body: "tajawal", button_radius: "full" });
    expect(merged.colors.primary).toBe("#FDE047");
    expect(merged.colors.background).toBe("#000000");
    expect(merged.colors.secondary).toBe("#F5F3FF");
    // A light primary gets dark text automatically.
    expect(merged.colors.primary_foreground).toBe("#111111");
    expect([merged.font_heading, merged.font_body, merged.button_radius]).toEqual(["readex_pro", "tajawal", "full"]);
    expect(merged.brand_name).toBe("متجر");
  });

  it("starts a custom design from the identity", () => {
    const design = designFromIdentity(identity);
    expect(design.colors).not.toHaveProperty("primary_foreground");
    expect(applyPageDesign(identity, design).colors).toEqual(identity.colors);
  });
});
