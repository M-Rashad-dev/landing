import { describe, expect, it } from "vitest";
import { formatCairo, fromCairoInputValue, toCairoInputValue } from "./dates";

describe("Cairo dates", () => {
  it("converts winter time (UTC+2)", () => {
    expect(toCairoInputValue("2026-01-15T08:00:00Z")).toBe("2026-01-15T10:00");
    expect(fromCairoInputValue("2026-01-15T10:00")).toBe("2026-01-15T08:00:00.000Z");
  });

  it("converts summer time (UTC+3, Egyptian DST)", () => {
    expect(toCairoInputValue("2026-07-15T08:00:00Z")).toBe("2026-07-15T11:00");
    expect(fromCairoInputValue("2026-07-15T11:00")).toBe("2026-07-15T08:00:00.000Z");
  });

  it("round-trips across a day boundary", () => {
    const utc = "2026-11-30T22:30:00.000Z";
    expect(toCairoInputValue(utc)).toBe("2026-12-01T00:30");
    expect(fromCairoInputValue(toCairoInputValue(utc))).toBe(utc);
  });

  it("handles empty and invalid values", () => {
    expect(toCairoInputValue(null)).toBe("");
    expect(toCairoInputValue("nope")).toBe("");
    expect(fromCairoInputValue("")).toBeNull();
    expect(fromCairoInputValue("2026-13")).toBeNull();
  });

  it("formats with latin digits", () => {
    expect(formatCairo("2026-07-15T08:05:00Z")).toBe("15/07/2026 11:05");
    expect(formatCairo("2026-01-15T08:05:00Z", { withTime: false })).toBe("15/01/2026");
  });
});
