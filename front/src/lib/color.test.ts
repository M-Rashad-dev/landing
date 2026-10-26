import { describe, expect, it } from "vitest";
import { contrastRatio, isHexColor, passesAA, readableOn, withAlpha } from "./color";

describe("contrast", () => {
  it("computes known ratios", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 1);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#7C3AED", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#7C3AED"), 10);
  });

  it("checks WCAG AA", () => {
    expect(passesAA("#FFFFFF", "#7C3AED")).toBe(true);
    expect(passesAA("#FFFFFF", "#FACC15")).toBe(false);
  });

  it("picks a readable foreground", () => {
    expect(readableOn("#FACC15")).toBe("#111111");
    expect(readableOn("#1E3A8A")).toBe("#FFFFFF");
  });
});

describe("helpers", () => {
  it("validates hex colors", () => {
    expect(isHexColor("#AABBCC")).toBe(true);
    expect(isHexColor("#abc")).toBe(false);
    expect(isHexColor("red")).toBe(false);
  });

  it("builds rgba", () => {
    expect(withAlpha("#FF0000", 0.1)).toBe("rgba(255, 0, 0, 0.1)");
  });
});
