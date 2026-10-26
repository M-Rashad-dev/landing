import { describe, expect, it } from "vitest";
import { safeHref, telHref, whatsappHref } from "./links";

describe("safeHref", () => {
  it.each(["#order", "#section-1a2b3c4d", "/offer", "/عرض-خاص", "https://example.com/x?y=1", "tel:+201012345678", "mailto:shop@example.com", "https://wa.me/201012345678"])("allows %s", (href) => {
    expect(safeHref(href)).toBe(href);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "http://example.com",
    "//evil.com",
    "/\\evil.com",
    "https://user:pass@evil.com",
    "#bad anchor",
    "tel:abc",
    "",
  ])("rejects %s", (href) => {
    expect(safeHref(href)).toBeNull();
  });
});

describe("phone links", () => {
  it("builds wa.me and tel links", () => {
    expect(whatsappHref("+201012345678")).toBe("https://wa.me/201012345678");
    expect(whatsappHref("+201012345678", "مرحبا")).toBe("https://wa.me/201012345678?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7");
    expect(telHref("+20 10 1234 5678")).toBe("tel:+201012345678");
    expect(whatsappHref(null)).toBeNull();
  });
});
