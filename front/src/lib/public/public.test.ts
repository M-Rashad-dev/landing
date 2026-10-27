import { describe, expect, it } from "vitest";
import { parseSiteHost, pathForSlug, primaryRedirectUrl, slugFromSegments } from "./host";
import { parseTags, secretMatches } from "./revalidate";
import { buildMetadata, jsonLdString, productJsonLd, stripMarkdown } from "./seo";
import type { PublicPagePayload } from "./types";
import { DEFAULT_COLORS } from "@/lib/identity/style";

function payload(overrides: Partial<PublicPagePayload> = {}): PublicPagePayload {
  return {
    page: { id: 1, slug: "offer", title: "صفحة", is_home: false, theme_key: "malak", published_at: null },
    theme_key: "malak",
    content: { version: 1, sections: [] },
    identity: {
      brand_name: "متجر رشاد",
      colors: { ...DEFAULT_COLORS, primary: "#112233" },
      font_heading: "cairo",
      font_body: "tajawal",
      button_radius: "md",
      logo: null,
      favicon: { icon32: "/media/f32.png", icon180: "/media/f180.png" },
      og_image: null,
      seo_title: null,
      seo_title_suffix: null,
      seo_description: null,
      contact: { phone: null, whatsapp: null, email: null, address: null },
      socials: { facebook: null, instagram: null, tiktok: null, youtube: null, x: null, snapchat: null },
    },
    product: {
      id: 7,
      name: "ساعة </script><script>alert(1)</script>",
      description: "**ساعة** رائعة مع [رابط](https://x.com)\n\n- مقاومة للماء",
      price: 500,
      compare_at_price: 700,
      available: true,
      images: [{ id: 1, alt: null, width: 800, height: 800, urls: { thumb: "/media/t.webp", medium: "/media/m.webp", large: "/media/l.webp" } }],
      options: [],
    },
    offers: [],
    media: {},
    seo: {
      title: "ساعة | متجر رشاد",
      description: "وصف",
      og_image: { url: "/media/og.webp", width: 1200, height: 630, alt: null },
      canonical: "https://rashad.example.com/offer",
      noindex: false,
      site_name: "متجر رشاد",
    },
    tracking: { meta_pixel_id: "1234567890", google_site_verification: "abcdefghijklmnop", facebook_domain_verification: "bad id with spaces", conversion_event: "Purchase" },
    ...overrides,
  };
}

describe("public host helpers", () => {
  it("parses only valid host names", () => {
    expect(parseSiteHost("Store.Localhost")).toBe("store.localhost");
    expect(parseSiteHost("shop.example.com")).toBe("shop.example.com");
    expect(parseSiteHost("bad host")).toBeNull();
    expect(parseSiteHost("%E0%A4%A")).toBeNull();
    expect(parseSiteHost("-x.com")).toBeNull();
  });

  it("allows one slug level only", () => {
    expect(slugFromSegments(undefined)).toBe("");
    expect(slugFromSegments(["%D8%B9%D8%B1%D8%B6"])).toBe("عرض");
    expect(slugFromSegments(["Offer"])).toBe("offer");
    expect(slugFromSegments(["a", "b"])).toBeNull();
  });

  it("builds the primary host redirect", () => {
    expect(primaryRedirectUrl("shop.example.com", pathForSlug("offer"))).toBe("https://shop.example.com/offer");
    expect(primaryRedirectUrl("shop.example.com", pathForSlug(""))).toBe("https://shop.example.com/");
    expect(primaryRedirectUrl("rashad.localhost", pathForSlug("عرض"), { scheme: "http", port: "3000" })).toBe("http://rashad.localhost:3000/%D8%B9%D8%B1%D8%B6");
    expect(primaryRedirectUrl("x.com", "/", { scheme: "javascript", port: "" })).toBe("https://x.com/");
  });
});

describe("SEO", () => {
  it("maps the merged SEO to metadata", () => {
    const meta = buildMetadata(payload());
    expect(meta.title).toEqual({ absolute: "ساعة | متجر رشاد" });
    expect(meta.description).toBe("وصف");
    expect(meta.alternates?.canonical).toBe("https://rashad.example.com/offer");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph).toMatchObject({ type: "website", locale: "ar_EG", images: [{ url: "https://rashad.example.com/media/og.webp", width: 1200, height: 630 }] });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.icons).toMatchObject({ icon: [{ url: "/media/f32.png", sizes: "32x32" }], apple: [{ url: "/media/f180.png", sizes: "180x180" }] });
    // Valid verification ids only.
    expect(meta.verification).toEqual({ google: "abcdefghijklmnop", other: undefined });
  });

  it("honours noindex and never inherits the platform description", () => {
    const meta = buildMetadata(payload({ seo: { ...payload().seo, noindex: true, description: "" } }));
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.description).toBeNull();
  });

  it("strips Markdown to plain text", () => {
    expect(stripMarkdown("## عنوان\n**عريض** و _مائل_ [رابط](https://x.com)\n- عنصر")).toBe("عنوان عريض و مائل رابط عنصر");
    expect(stripMarkdown(null)).toBe("");
  });

  it("builds Product JSON-LD with the best active offer price", () => {
    const ends = new Date(Date.now() + 86400000).toISOString();
    const data = payload({
      offers: [{ id: 1, name: "خصم", type: "percentage", value: 20, bundle_quantity: null, bundle_price: null, starts_at: null, ends_at: ends, status: "active", badge_text: null, priority: 0 }],
    });
    const ld = productJsonLd(data)!;
    expect(ld["@type"]).toBe("Product");
    expect(ld.image).toEqual(["https://rashad.example.com/media/l.webp"]);
    expect(ld.description).toBe("ساعة رائعة مع رابط مقاومة للماء");
    expect(ld.offers).toMatchObject({ price: "400.00", priceCurrency: "EGP", availability: "https://schema.org/InStock", priceValidUntil: ends.slice(0, 10) });
    expect(productJsonLd(payload({ product: null }))).toBeNull();
  });

  it("escapes < so user text cannot close the script tag", () => {
    const json = jsonLdString(productJsonLd(payload()));
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
    expect(JSON.parse(json).name).toBe("ساعة </script><script>alert(1)</script>");
  });
});

describe("revalidate endpoint helpers", () => {
  it("compares secrets in constant time and rejects empty ones", () => {
    expect(secretMatches("abc", "abc")).toBe(true);
    expect(secretMatches("abd", "abc")).toBe(false);
    expect(secretMatches("ab", "abc")).toBe(false);
    expect(secretMatches("", "")).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
  });

  it("accepts 1..50 tags", () => {
    expect(parseTags({ tags: ["host:a.localhost", "host:a.localhost"] })).toEqual(["host:a.localhost"]);
    expect(parseTags({ tags: [] })).toBeNull();
    expect(parseTags({ tags: Array.from({ length: 51 }, (_, i) => `host:${i}`) })).toBeNull();
    expect(parseTags({ tags: [1] })).toBeNull();
    expect(parseTags(null)).toBeNull();
  });
});
