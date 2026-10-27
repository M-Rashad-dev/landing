import { timingSafeEqual } from "node:crypto";

export const MAX_TAGS = 50;

/** Constant-time secret check (an empty configured secret never matches). */
export function secretMatches(given: string | null, expected: string): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Accepts { tags: string[] } with 1..50 short "host:..." style tags. */
export function parseTags(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { tags?: unknown }).tags)) return null;
  const tags = (body as { tags: unknown[] }).tags;
  if (tags.length === 0 || tags.length > MAX_TAGS) return null;
  if (!tags.every((tag) => typeof tag === "string" && tag.length > 0 && tag.length <= 300 && /^[\x21-\x7e]+$/.test(tag))) return null;
  return Array.from(new Set(tags as string[]));
}
