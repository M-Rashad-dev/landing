import { describe, expect, it } from "vitest";
import { siteUrl } from "@/components/dashboard/session-context";
import { isValidLabel, labelOf, normalizeHost } from "./api";

describe("normalizeHost (mirror of DomainRules::normalize)", () => {
  it.each([
    ["HTTPS://Shop.Example.COM/offer?x=1", "shop.example.com"],
    ["example.com.:8080", "example.com"],
    ["www.example.com.", "www.example.com"],
    ["  http://user@example.net/  ", "example.net"],
    ["متجر.مصر", "xn--pgbep1f.xn--wgbh1c"],
    ["https://متجر.مصر/عرض", "xn--pgbep1f.xn--wgbh1c"],
    ["", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });
});

describe("subdomain labels", () => {
  it("accepts 3–30 lowercase letters, digits and inner dashes", () => {
    expect(isValidLabel("my-shop")).toBe(true);
    expect(isValidLabel("abc")).toBe(true);
    expect(isValidLabel("ab")).toBe(false);
    expect(isValidLabel("-shop")).toBe(false);
    expect(isValidLabel("shop-")).toBe(false);
    expect(isValidLabel("My-Shop")).toBe(false);
    expect(isValidLabel("a".repeat(31))).toBe(false);
  });

  it("extracts the label from the free subdomain", () => {
    expect(labelOf("rashad-4821.platform.com", "platform.com")).toBe("rashad-4821");
    expect(labelOf("brand.com", "platform.com")).toBe("brand.com");
  });
});

describe("siteUrl", () => {
  it("uses the public scheme and port", () => {
    expect(siteUrl("brand.com", "/offer")).toBe("https://brand.com/offer");
    expect(siteUrl("shop.localtest.me", "/", { scheme: "http", port: "3000" })).toBe("http://shop.localtest.me:3000/");
    expect(siteUrl(null)).toBe("");
  });
});
