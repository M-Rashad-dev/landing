import { describe, expect, it } from "vitest";
import { formatPhoneLocal, isValidPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["01012345678", "+201012345678"],
    ["01112345678", "+201112345678"],
    ["01212345678", "+201212345678"],
    ["01512345678", "+201512345678"],
    ["+201012345678", "+201012345678"],
    ["00201012345678", "+201012345678"],
    ["201012345678", "+201012345678"],
    ["010 1234-5678", "+201012345678"],
    ["(010) 1234 5678", "+201012345678"],
    ["٠١٠١٢٣٤٥٦٧٨", "+201012345678"],
    ["۰۱۰۱۲۳۴۵۶۷۸", "+201012345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["0223456789", "01312345678", "0101234567", "010123456789", "01012345abc", "", "+966512345678"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
    expect(isValidPhone(input)).toBe(false);
  });

  it("handles null and undefined", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("formats E.164 for local display", () => {
    expect(formatPhoneLocal("+201012345678")).toBe("01012345678");
    expect(formatPhoneLocal(null)).toBe("");
  });
});
