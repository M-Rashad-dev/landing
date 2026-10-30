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
    expect(night.foreground).toBe(DEFAULT_COLORS.background);
    expect(contrastRatio(night.foreground, night.background)).toBeGreaterThanOrEqual(12);
    expect(contrastRatio(night.muted, night.background)).toBeGreaterThanOrEqual(4.5);
    expect(night.primary).toBe(DEFAULT_COLORS.primary);
    expect(night.accent).toBe(DEFAULT_COLORS.accent);
  });

  it("keeps an identity that is already dark the right way round", () => {
    const dark = { ...DEFAULT_COLORS, background: "#101010", foreground: "#F5F5F5" };
    const night = nightColors(dark);
    expect(night.foreground).toBe("#F5F5F5");
    expect(relativeLuminance(night.background)).toBeLessThan(relativeLuminance("#101010") + 0.001);
  });
});
