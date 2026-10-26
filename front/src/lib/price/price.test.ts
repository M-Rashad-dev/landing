import { describe, expect, it } from "vitest";
import { discountPercent, formatPrice, toCents } from "./index";

describe("formatPrice", () => {
  it("formats whole amounts with separators and currency", () => {
    expect(formatPrice(1250)).toBe("1,250 ج.م");
    expect(formatPrice("350.00")).toBe("350 ج.م");
    expect(formatPrice(1234567)).toBe("1,234,567 ج.م");
  });

  it("keeps two decimals for fractional amounts", () => {
    expect(formatPrice(99.5)).toBe("99.50 ج.م");
    expect(formatPrice("1250.75")).toBe("1,250.75 ج.م");
  });

  it("uses latin digits only", () => {
    expect(formatPrice(9876.5)).toMatch(/^[0-9,.]+ ج\.م$/);
  });

  it("can omit the currency", () => {
    expect(formatPrice(1250, { withCurrency: false })).toBe("1,250");
  });

  it("treats invalid input as zero", () => {
    expect(formatPrice(null)).toBe("0 ج.م");
    expect(formatPrice("abc")).toBe("0 ج.م");
  });
});

describe("discountPercent", () => {
  it("computes the rounded percentage", () => {
    expect(discountPercent(300, 400)).toBe(25);
    expect(discountPercent("199", "299")).toBe(33);
  });

  it("returns null when there is no discount", () => {
    expect(discountPercent(400, 300)).toBeNull();
    expect(discountPercent(400, 400)).toBeNull();
    expect(discountPercent(400, null)).toBeNull();
  });
});

describe("toCents", () => {
  it("converts without float drift", () => {
    expect(toCents("0.1")).toBe(10);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1.005)).toBe(101);
  });
});
