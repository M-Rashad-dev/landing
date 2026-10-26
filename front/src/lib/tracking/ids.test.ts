import { describe, expect, it } from "vitest";
import { isValidTrackingId, normalizeTrackingId, validTracking, type TrackingKey } from "./ids";

describe("tracking ids", () => {
  it.each<[TrackingKey, string]>([
    ["meta_pixel_id", "1234567890"],
    ["meta_pixel_id", "12345678901234567890"],
    ["tiktok_pixel_id", "CABCDEFGHIJ1234"],
    ["tiktok_pixel_id", "cabcdefghij1234"],
    ["ga4_id", "G-ABCDEF"],
    ["ga4_id", "g-abc123xyz"],
    ["gtm_id", "GTM-ABCD"],
    ["snapchat_pixel_id", "0F8FAD5B-D9CB-469F-A165-70867728950E"],
    ["google_site_verification", "aB3_-xYz9QwErTy"],
    ["facebook_domain_verification", "abcdef1234567890"],
  ])("accepts %s = %s", (key, value) => {
    expect(isValidTrackingId(key, value)).toBe(true);
  });

  it.each<[TrackingKey, string]>([
    ["meta_pixel_id", "123"],
    ["meta_pixel_id", '"><script>alert(1)</script>'],
    ["tiktok_pixel_id", "C123');alert(1);//"],
    ["ga4_id", "UA-12345-1"],
    ["gtm_id", "GTM-AB"],
    ["snapchat_pixel_id", "not-a-uuid"],
    ["google_site_verification", 'abc"><meta>'],
    ["facebook_domain_verification", "has spaces in it"],
  ])("rejects %s = %s", (key, value) => {
    expect(isValidTrackingId(key, value)).toBe(false);
  });

  it("normalizes like the back end", () => {
    expect(normalizeTrackingId("ga4_id", " g-abc123 ")).toBe("G-ABC123");
    expect(normalizeTrackingId("snapchat_pixel_id", "ABC")).toBe("abc");
  });

  it("filters invalid ids and defaults the conversion event", () => {
    expect(validTracking({ meta_pixel_id: "1234567890", ga4_id: "bad", conversion_event: null })).toEqual({
      meta_pixel_id: "1234567890",
      conversion_event: "Lead",
    });
  });
});
