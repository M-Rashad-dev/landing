import { ar } from "@/messages/ar";

/** What the owner wrote (empty = automatic). */
export type SeoValue = { title?: string; description?: string; keywords?: string[]; noindex?: boolean; og_media_id?: number | null };

/** What the store uses for empty fields. */
export type SeoAuto = { title: string; description: string; keywords: string[] };

export const SEO_LIMITS = { title: 70, description: 170, keywords: 10, keyword: 40 };

/*
 * Live preview of the automatic SEO while typing. Mirror of App\Store\SeoDefaults (the back end
 * is the reference: the store page uses its result).
 */

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 160;
const KEYWORDS_MAX = 8;

function limit(text: string, max: number, words = false): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  if (words && cut.includes(" ")) cut = cut.slice(0, cut.lastIndexOf(" "));
  return `${cut.trimEnd()}…`;
}

/** Plain text out of the small Markdown subset (mirror of App\Support\PlainText). */
export function plainText(markdown: string | null | undefined, max = DESCRIPTION_MAX): string {
  if (!markdown?.trim()) return "";
  const text = markdown
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return limit(text, max, true);
}

function title(name: string, store: string): string {
  const suffix = store ? ` | ${store}` : "";
  const room = TITLE_MAX - suffix.length;
  return room > 10 ? `${limit(name, room)}${suffix}` : limit(name, TITLE_MAX);
}

function keywords(words: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const w of words) {
    const word = (w ?? "").trim();
    if (word && !out.some((o) => o.toLowerCase() === word.toLowerCase())) out.push(word);
  }
  return out.slice(0, KEYWORDS_MAX);
}

function price(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function autoProductSeo(p: { name: string; shortDescription: string; description: string; price: number; categories: string[] }, store: string): SeoAuto {
  const short = p.shortDescription.trim();
  const description = (short ? limit(short, DESCRIPTION_MAX, true) : plainText(p.description)) || ar.catalog.seo.productSentence(p.name, price(p.price), store);
  return { title: title(p.name, store), description, keywords: keywords([p.name, ...p.categories, store]) };
}

export function autoCategorySeo(c: { name: string; description: string; ancestors: string[] }, store: string): SeoAuto {
  return {
    title: title(c.name, store),
    description: plainText(c.description) || ar.catalog.seo.categorySentence(c.name, store),
    keywords: keywords([c.name, ...c.ancestors, store]),
  };
}

/** The request body: empty fields are left out (automatic). */
export function cleanSeo(seo: SeoValue): SeoValue | null {
  const out: SeoValue = {};
  if (seo.title?.trim()) out.title = seo.title.trim();
  if (seo.description?.trim()) out.description = seo.description.trim();
  if (seo.keywords?.length) out.keywords = seo.keywords;
  if (seo.noindex) out.noindex = true;
  if (seo.og_media_id) out.og_media_id = seo.og_media_id;
  return Object.keys(out).length ? out : null;
}
