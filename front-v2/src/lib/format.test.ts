import { describe, expect, it } from "vitest";
import { formatDateTime, formatMoney, formatNumber, formatPercent, formatPhone } from "./format";

describe("format", () => {
  it("formats money with Latin digits and the currency", () => {
    expect(formatMoney(1250.5)).toBe("1,250.5 ج.م");
    expect(formatMoney("300")).toBe("300 ج.م");
    expect(formatMoney(99, { withCurrency: false })).toBe("99");
    expect(formatMoney(null)).toBe("—");
  });

  it("formats numbers and signed percentages", () => {
    expect(formatNumber(1240500)).toBe("1,240,500");
    expect(formatPercent(12.345, { signed: true })).toBe("+12.35%");
    expect(formatPercent(-4.2, { signed: true })).toBe("−4.2%");
    expect(formatPercent(0, { signed: true })).toBe("0%");
  });

  it("shows dates in Cairo time and phones in local form", () => {
    expect(formatDateTime("2026-11-11T13:29:00Z")).toBe("11/11/2026 15:29");
    expect(formatDateTime("not a date")).toBe("—");
    expect(formatPhone("+201012345678")).toBe("01012345678");
  });
});
