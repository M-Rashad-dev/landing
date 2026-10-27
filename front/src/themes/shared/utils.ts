import type { PageContext, PublicImage } from "@/themes/types";

/** Resolve a *_media_id prop to its image (null when missing). */
export function mediaOf(ctx: PageContext, id: unknown): PublicImage | null {
  return typeof id === "number" ? (ctx.media[id] ?? null) : null;
}

export function mediaList(ctx: PageContext, ids: unknown): PublicImage[] {
  return Array.isArray(ids) ? ids.map((id) => mediaOf(ctx, id)).filter((image): image is PublicImage => image !== null) : [];
}

export function brandName(ctx: PageContext, override: unknown): string {
  return typeof override === "string" && override.trim() ? override.trim() : ctx.identity.brand_name;
}

/** Header/footer logo: explicit image, otherwise the identity logo. */
export function logoOf(ctx: PageContext, mediaId: unknown): PublicImage | null {
  return mediaOf(ctx, mediaId) ?? ctx.identity.logo;
}

export function nonEmpty<T extends Record<string, unknown>>(items: unknown, key: keyof T): T[] {
  return Array.isArray(items) ? (items as T[]).filter((item) => item && typeof item[key] === "string" && (item[key] as string).trim() !== "") : [];
}

export const SOCIAL_ORDER = ["facebook", "instagram", "tiktok", "youtube", "x", "snapchat"] as const;

export function socialsOf(ctx: PageContext): Array<{ network: (typeof SOCIAL_ORDER)[number]; url: string }> {
  return SOCIAL_ORDER.flatMap((network) => {
    const url = ctx.identity.socials[network];
    return url ? [{ network, url }] : [];
  });
}
