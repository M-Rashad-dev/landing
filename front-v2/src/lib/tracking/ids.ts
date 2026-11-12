/**
 * Tracking id formats — mirror of back/app/Support/TrackingIds.php.
 * Only ids matching these are ever injected into a page.
 */
export const TRACKING_KEYS = [
  "meta_pixel_id",
  "tiktok_pixel_id",
  "ga4_id",
  "gtm_id",
  "snapchat_pixel_id",
  "google_site_verification",
  "facebook_domain_verification",
] as const;

export type TrackingKey = (typeof TRACKING_KEYS)[number];
export type ConversionEvent = "Lead" | "Purchase";

export type Tracking = Partial<Record<TrackingKey, string | null>> & { conversion_event?: ConversionEvent | null };

export const TRACKING_PATTERNS: Record<TrackingKey, RegExp> = {
  meta_pixel_id: /^\d{10,20}$/,
  tiktok_pixel_id: /^[A-Z0-9]{10,30}$/,
  ga4_id: /^G-[A-Z0-9]{6,14}$/,
  gtm_id: /^GTM-[A-Z0-9]{4,10}$/,
  snapchat_pixel_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  google_site_verification: /^[A-Za-z0-9_-]{10,100}$/,
  facebook_domain_verification: /^[A-Za-z0-9_-]{10,100}$/,
};

/** Same normalisation as the back end (trim; some ids are case-insensitive). */
export function normalizeTrackingId(key: TrackingKey, value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (key === "tiktok_pixel_id" || key === "ga4_id" || key === "gtm_id") return trimmed.toUpperCase();
  if (key === "snapchat_pixel_id") return trimmed.toLowerCase();
  return trimmed;
}

export function isValidTrackingId(key: TrackingKey, value: string | null | undefined): boolean {
  const normalized = normalizeTrackingId(key, value);
  return normalized !== "" && TRACKING_PATTERNS[key].test(normalized);
}

/** Keeps only valid ids (used before injecting scripts). */
export function validTracking(tracking: Tracking | null | undefined): Partial<Record<TrackingKey, string>> & { conversion_event: ConversionEvent } {
  const result: Partial<Record<TrackingKey, string>> = {};
  for (const key of TRACKING_KEYS) {
    const value = tracking?.[key];
    if (value && isValidTrackingId(key, value)) result[key] = normalizeTrackingId(key, value);
  }
  return { ...result, conversion_event: tracking?.conversion_event === "Lead" ? "Lead" : "Purchase" };
}
