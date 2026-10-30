import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "@/lib/color";
import { DEFAULT_COLORS } from "./style";
import { mixHex, nightColors } from "./night";

describe("night palette", () => {
  it("mixes colors", () => {
    expect(mixHex("#FFFFFF", "#000000", 0.5)).toBe("#808080");
    expect(mixHex("#FF0000", "#0000FF", 1)).toBe("#FF0000");
  });

  it("turns a light identity into a dark page with readable text, keeping brand colors", () => {
    const night = nightColors(DEFAULT_COLORS);
    expect(relativeLuminance(night.background)).toBeLessThan(0.03);
    expect(contrastRatio(night.foreground, night.background)).toBeGreaterThanOrEqual(12);
    expect(contrastRatio(night.muted, night.background)).toBeGreaterThanOrEqual(4.5);
    expect(night.primary).toBe(DEFAULT_COLORS.primary);
    expect(night.accent).toBe(DEFAULT_COLORS.accent);
  });

  it("never turns the text color into the page (red text on a light background)", () => {
    const night = nightColors({ ...DEFAULT_COLORS, primary: "#000000", background: "#FFFBF7", foreground: "#FF0000" });
    expect(night.background).not.toBe("#FF0000");
    expect(relativeLuminance(night.background)).toBeLessThan(0.03);
    // Red does not read well enough on black for body text, so text falls back to soft white.
    expect(contrastRatio(night.foreground, night.background)).toBeGreaterThanOrEqual(7);
  });

  it("uses the merchant's own dark background and light text as they are", () => {
    const night = nightColors({ ...DEFAULT_COLORS, background: "#0B1D3A", foreground: "#FDE68A" });
    expect(night.background).toBe("#0B1D3A");
    expect(night.foreground).toBe("#FDE68A");
  });
});
