import type { ProductCard } from "@/themes/store/shared/types";
import type { AiField } from "./types";

export const PLACEHOLDER_PREFIX = "__AI_SAFE_DATA_SVG__:";

/**
 * Generates an inline SVG data URL placeholder (soft grey-blue box with an image icon).
 * Marked with an internal prefix so `safeUrl` only permits data URLs originating here.
 */
export function placeholderImage(label = "صورة"): string {
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .slice(0, 32);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">` +
    `<rect width="600" height="400" fill="#e8eef5"/>` +
    `<g fill="none" stroke="#94a3b8" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" transform="translate(240,130)">` +
    `<rect x="0" y="0" width="120" height="95" rx="12" fill="#f8fafc"/>` +
    `<circle cx="38" cy="34" r="10" fill="#94a3b8" stroke="none"/>` +
    `<path d="M12 80 L46 48 L72 72 L90 56 L108 80"/>` +
    `</g>` +
    `<text x="300" y="265" text-anchor="middle" fill="#64748b" font-family="Cairo, sans-serif" font-size="22" font-weight="600">${safeLabel}</text>` +
    `</svg>`;

  return `${PLACEHOLDER_PREFIX}data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function isPlaceholderUrl(url: string): boolean {
  return url.startsWith(PLACEHOLDER_PREFIX);
}

export function unwrapPlaceholderUrls(html: string): string {
  return html.split(PLACEHOLDER_PREFIX).join("");
}

export function sampleProducts(count = 4): ProductCard[] {
  const n = Math.max(1, Math.min(12, count));
  const basePrices = [199, 249, 299, 349, 399, 449, 499, 549];

  return Array.from({ length: n }, (_, i) => {
    const price = basePrices[i % basePrices.length] ?? 199;
    const hasDiscount = i % 2 === 1;
    const compareAt = hasDiscount ? price + 80 : null;
    const discountPercent = compareAt ? Math.round(((compareAt - price) / compareAt) * 100) : null;
    const imgUrl = placeholderImage(`منتج تجريبي ${i + 1}`);

    return {
      id: i + 1,
      slug: `sample-product-${i + 1}`,
      name: `منتج تجريبي ${i + 1}`,
      short_description: "وصف قصير للمنتج التجريبي",
      price,
      compare_at_price: compareAt,
      discount_percent: discountPercent,
      image: {
        id: i + 1,
        alt: `منتج تجريبي ${i + 1}`,
        width: 600,
        height: 400,
        urls: { thumb: imgUrl, medium: imgUrl, large: imgUrl },
      },
      available: true,
      needs_options: false,
      rating: { average: 4.8, count: 12 + i * 3 },
    };
  });
}

export function sampleCategories(count = 4): Array<{ id: number; name: string; count: number; image: string; url: string }> {
  const n = Math.max(1, Math.min(8, count));
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `تصنيف ${i + 1}`,
    count: (i + 1) * 6,
    image: placeholderImage(`تصنيف ${i + 1}`),
    url: "#categories",
  }));
}

export function sampleValues(fields: AiField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const field of fields) {
    switch (field.type) {
      case "text":
      case "textarea":
        out[field.key] = typeof field.sample === "string" && field.sample !== "" ? field.sample : field.label;
        break;
      case "number":
        out[field.key] = typeof field.sample === "number" ? field.sample : (field.min ?? 10);
        break;
      case "toggle":
        out[field.key] = typeof field.sample === "boolean" ? field.sample : true;
        break;
      case "date": {
        const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        out[field.key] = future.toISOString();
        break;
      }
      case "list": {
        const subFields = field.fields ?? [];
        const rawList = Array.isArray(field.sample) ? field.sample : [];
        if (rawList.length > 0) {
          out[field.key] = rawList.map((item) => {
            const row = typeof item === "object" && item !== null ? { ...(item as Record<string, unknown>) } : {};
            for (const sub of subFields) {
              if (row[sub.key] === undefined) {
                if (sub.type === "text" || sub.type === "textarea") {
                  row[sub.key] = typeof sub.sample === "string" && sub.sample !== "" ? sub.sample : sub.label;
                } else if (sub.type === "number") {
                  row[sub.key] = typeof sub.sample === "number" ? sub.sample : (sub.min ?? 1);
                } else if (sub.type === "toggle") {
                  row[sub.key] = typeof sub.sample === "boolean" ? sub.sample : true;
                }
              }
            }
            return row;
          });
        } else {
          const count = Math.min(3, Math.max(1, field.max ?? 6));
          out[field.key] = Array.from({ length: count }, () => sampleValues(subFields));
        }
        break;
      }
      default:
        break;
    }
  }

  return out;
}

const PRODUCT_LIMITS = [4, 8, 12, 16, 24, 32] as const;

/**
 * Initial saved `values` for a newly placed (or updated) AI section placement, matching what
 * previews and the Builder display so live pages never start empty.
 */
export function initialAiValues(
  fields: AiField[],
  kind: "store" | "landing" = "store",
): Record<string, unknown> {
  const out: Record<string, unknown> = sampleValues(fields);

  for (const field of fields) {
    if (field.type === "image") {
      const mediaId =
        typeof field.sample_media_id === "number"
          ? field.sample_media_id
          : typeof field.sample === "number"
            ? field.sample
            : null;
      if (mediaId !== null && mediaId > 0) {
        out[`${field.key}_media_id`] = mediaId;
      }
    } else if (field.type === "products" && kind === "store") {
      const wanted = typeof field.sample === "number" ? field.sample : 4;
      const limit = PRODUCT_LIMITS.find((n) => n >= wanted) ?? 32;
      out[field.key] = {
        source: "latest",
        category_id: null,
        product_ids: [],
        limit,
      };
    }
  }

  return out;
}

/**
 * When an existing AI section is edited to add brand-new fields (or still has `{}` empty values),
 * seed defaults only for newly introduced keys without disturbing previously edited/cleared fields.
 */
export function mergeNewAiFieldValues(
  existingValues: Record<string, unknown>,
  prevFields: AiField[] | undefined,
  nextFields: AiField[],
  kind: "store" | "landing" = "store",
): { values: Record<string, unknown>; changed: boolean } {
  const isEmpty = Object.keys(existingValues).length === 0;
  const hadKeys = isEmpty ? new Set<string>() : new Set((prevFields ?? []).map((f) => f.key));
  const addedFields = nextFields.filter((f) => !hadKeys.has(f.key));
  if (addedFields.length === 0) {
    return { values: existingValues, changed: false };
  }

  const additions = initialAiValues(addedFields, kind);
  const next = { ...existingValues };
  let changed = false;

  for (const [k, v] of Object.entries(additions)) {
    if (!(k in next) || next[k] === undefined) {
      next[k] = v;
      changed = true;
    }
  }

  return { values: next, changed };
}

