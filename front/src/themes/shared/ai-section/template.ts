import { pick } from "@/themes/shared/design";
import type { ProductCard } from "@/themes/store/shared/types";
import { isPlaceholderUrl, unwrapPlaceholderUrls } from "./sample";
import type { AiFieldType, AiRenderProduct } from "./types";

export type CategoryRenderItem = {
  id?: number;
  name: string;
  count?: number;
  products_count?: number;
  image?: string | { urls?: Record<string, string> } | null;
  slug?: string;
  url?: string;
};

export type ImageRenderItem = {
  img: string;
  alt?: string;
};

export type RenderCtx = {
  value: (key: string) => unknown;
  fieldType?: (key: string, parentListKey?: string) => AiFieldType | undefined;
  image: (key: string) => string | null;
  images?: (key: string) => ImageRenderItem[];
  link: (key: string) => string | null;
  date: (key: string) => string | null;
  list: (key: string) => Array<Record<string, unknown>>;
  listImage?: (listKey: string, index: number, subKey: string, item: Record<string, unknown>) => string | null;
  listLink?: (listKey: string, index: number, subKey: string, item: Record<string, unknown>) => string | null;
  products: (key: string) => ProductCard[];
  categories: (key: string) => CategoryRenderItem[];
  product?: AiRenderProduct | null;
  formatMoney: (amount: number) => string;
};

export function escapeHtml(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (trimmed === "") return "#";

  if (isPlaceholderUrl(trimmed)) {
    return trimmed;
  }

  // Decode basic HTML entities and strip control characters to defeat obfuscated javascript: or data: URLs
  const collapsed = trimmed.replace(/[\u0000-\u0020]+/g, "");
  if (/^(javascript|vbscript|data):/i.test(collapsed)) {
    return "#";
  }

  if (/^#[a-zA-Z0-9_-]*$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\/(?!\/)[^\s"'<>]*$/.test(trimmed)) {
    return trimmed;
  }

  if (/^https:\/\/[^\s"'<>]+$/i.test(trimmed)) {
    return trimmed;
  }

  // Local development media server
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/media\/[^\s"'<>]+$/i.test(trimmed)) {
    return trimmed;
  }

  return "#";
}

type EachScope = {
  listKey: string;
  kind: "products" | "categories" | "images" | "list";
  index: number;
  raw: Record<string, unknown>;
  text: Record<string, string>;
  textareaKeys?: Set<string>;
  images: Record<string, string | null>;
  links: Record<string, string | null>;
  truthy: Record<string, boolean>;
};

export function renderTemplate(html: string, ctx: RenderCtx): string {
  if (!html) return "";

  // Step 1: Expand {{#each key}}...{{/each}} blocks (no nested #each allowed)
  const afterEach = html.replace(
    /\{\{\s*#each\s+([a-z][a-z0-9_]*)\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/g,
    (_match, key: string, body: string) => {
      const scopes = buildEachScopes(key, ctx);
      if (scopes.length === 0) return "";
      return scopes.map((scope) => renderBlock(body, ctx, scope, 0)).join("");
    },
  );

  // Step 2: Expand top-level {{#if}} and tokens
  const rendered = renderBlock(afterEach, ctx, null, 0);

  // Step 3: Add target="_blank" rel="noopener noreferrer" to external https:// links
  const withExternalLinks = rendered.replace(
    /<a\b([^>]*?\bhref="https:\/\/[^"]*"[^>]*)>/gi,
    (full, attrs: string) => {
      let cleanAttrs = attrs
        .replace(/\s*\btarget=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\s*\brel=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      return `<a${cleanAttrs} target="_blank" rel="noopener noreferrer">`;
    },
  );

  // Step 4: Unwrap internal placeholder prefix to real data:image/svg+xml URL
  return unwrapPlaceholderUrls(withExternalLinks);
}

function renderBlock(fragment: string, ctx: RenderCtx, scope: EachScope | null, depth: number): string {
  const withIfs = depth < 3 ? evaluateIfBlocks(fragment, ctx, scope, depth) : fragment;

  return withIfs.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, rawExpr: string) => {
    const expr = rawExpr.trim().replace(/\s+/g, " ");
    return resolveToken(expr, ctx, scope);
  });
}

/**
 * Evaluates {{#if key}}...{{else}}...{{/if}} blocks with support for up to 2 levels of nesting.
 */
function evaluateIfBlocks(fragment: string, ctx: RenderCtx, scope: EachScope | null, depth: number): string {
  const tokenRegex = /\{\{\s*(#if\s+[a-zA-Z0-9_.]+|else|\/if)\s*\}\}/g;
  let result = "";
  let cursor = 0;

  while (cursor < fragment.length) {
    tokenRegex.lastIndex = cursor;
    const openMatch = tokenRegex.exec(fragment);
    if (!openMatch) {
      result += fragment.slice(cursor);
      break;
    }

    const openToken = openMatch[1]!.trim().replace(/\s+/g, " ");
    if (!openToken.startsWith("#if ")) {
      // Stray else or /if
      result += fragment.slice(cursor, openMatch.index);
      cursor = tokenRegex.lastIndex;
      continue;
    }

    result += fragment.slice(cursor, openMatch.index);
    const condKey = openToken.slice(4).trim();
    const bodyStart = tokenRegex.lastIndex;

    let level = 1;
    let elseRange: [number, number] | null = null;
    let closeRange: [number, number] | null = null;

    while (level > 0) {
      const nextMatch = tokenRegex.exec(fragment);
      if (!nextMatch) break;
      const t = nextMatch[1]!.trim().replace(/\s+/g, " ");
      if (t.startsWith("#if ")) {
        level++;
      } else if (t === "else" && level === 1 && elseRange === null) {
        elseRange = [nextMatch.index, tokenRegex.lastIndex];
      } else if (t === "/if") {
        level--;
        if (level === 0) {
          closeRange = [nextMatch.index, tokenRegex.lastIndex];
        }
      }
    }

    if (!closeRange) {
      // Unclosed #if
      cursor = bodyStart;
      continue;
    }

    const trueBranch = elseRange
      ? fragment.slice(bodyStart, elseRange[0])
      : fragment.slice(bodyStart, closeRange[0]);
    const falseBranch = elseRange ? fragment.slice(elseRange[1], closeRange[0]) : "";

    const isTrue = isConditionTruthy(condKey, ctx, scope);
    const chosen = isTrue ? trueBranch : falseBranch;
    result += renderBlock(chosen, ctx, scope, depth + 1);
    cursor = closeRange[1];
  }

  return result;
}

function isConditionTruthy(key: string, ctx: RenderCtx, scope: EachScope | null): boolean {
  if (key.startsWith("product.")) {
    const p = ctx.product;
    if (!p) return false;
    if (key === "product.name") return Boolean(p.name && p.name.trim() !== "");
    if (key === "product.price") return typeof p.price === "number";
    if (key === "product.old_price") return typeof p.compare_at_price === "number" && p.compare_at_price > p.price;
    if (key === "product.image") return Boolean(p.image);
    return false;
  }

  if (scope && key in scope.truthy) {
    return Boolean(scope.truthy[key]);
  }

  const fType = ctx.fieldType?.(key);
  if (fType === "image") {
    return Boolean(ctx.image(key));
  }
  if (fType === "images") {
    return (ctx.images?.(key) ?? []).length > 0;
  }
  if (fType === "products") {
    return ctx.products(key).length > 0;
  }
  if (fType === "categories") {
    return ctx.categories(key).length > 0;
  }
  if (fType === "list") {
    return ctx.list(key).length > 0;
  }
  if (fType === "link") {
    const l = ctx.link(key);
    return Boolean(l && l !== "#");
  }
  if (fType === "date") {
    return Boolean(ctx.date(key));
  }

  const val = ctx.value(key);
  if (val === null || val === undefined || val === false || val === "") {
    return false;
  }
  if (Array.isArray(val)) {
    return val.length > 0;
  }

  return true;
}

function resolveToken(expr: string, ctx: RenderCtx, scope: EachScope | null): string {
  if (
    expr.startsWith("#each") ||
    expr === "/each" ||
    expr.startsWith("#if") ||
    expr === "else" ||
    expr === "/if"
  ) {
    return "";
  }

  if (expr === "index") {
    return scope ? String(scope.index) : "";
  }

  if (expr === "order_link") {
    return "#order";
  }

  if (expr === "product.name") {
    return escapeHtml(ctx.product?.name ?? "");
  }

  if (expr === "product.price") {
    return ctx.product ? escapeHtml(ctx.formatMoney(ctx.product.price)) : "";
  }

  if (expr === "product.old_price") {
    const p = ctx.product;
    return p && typeof p.compare_at_price === "number" && p.compare_at_price > p.price
      ? escapeHtml(ctx.formatMoney(p.compare_at_price))
      : "";
  }

  if (expr === "img product.image") {
    return escapeHtml(safeUrl(ctx.product?.image));
  }

  if (expr === "img") {
    if (scope && scope.kind === "images") {
      return escapeHtml(safeUrl(scope.images.img));
    }
    return escapeHtml("#");
  }

  if (expr.startsWith("img ")) {
    const key = expr.slice(4).trim();
    if (scope && key in scope.images) {
      return escapeHtml(safeUrl(scope.images[key]));
    }
    return escapeHtml(safeUrl(ctx.image(key)));
  }

  if (expr.startsWith("link ")) {
    const key = expr.slice(5).trim();
    if (scope && key in scope.links) {
      return escapeHtml(safeUrl(scope.links[key]));
    }
    return escapeHtml(safeUrl(ctx.link(key)));
  }

  if (expr.startsWith("date ")) {
    const key = expr.slice(5).trim();
    return escapeHtml(ctx.date(key) ?? "");
  }

  if (expr === "id") {
    if (scope && scope.kind === "products") {
      return escapeHtml(scope.text.id ?? "");
    }
    return "";
  }

  // Plain field or item key
  if (scope && expr in scope.text) {
    const val = scope.text[expr] ?? "";
    const escaped = escapeHtml(val);
    return scope.textareaKeys?.has(expr) ? escaped.replace(/\r?\n/g, "<br>") : escaped;
  }

  const topVal = ctx.value(expr);
  if (topVal === null || topVal === undefined || typeof topVal === "object" || typeof topVal === "boolean") {
    return "";
  }
  const escaped = escapeHtml(topVal);
  return ctx.fieldType?.(expr) === "textarea" ? escaped.replace(/\r?\n/g, "<br>") : escaped;
}

function buildEachScopes(key: string, ctx: RenderCtx): EachScope[] {
  const fType = ctx.fieldType?.(key);

  if (fType === "products") {
    return ctx.products(key).map((p, idx) => {
      const hasOld = typeof p.compare_at_price === "number" && p.compare_at_price > p.price;
      const oldPriceStr = hasOld ? ctx.formatMoney(p.compare_at_price!) : "";
      const discountStr = p.discount_percent ? `${p.discount_percent}%` : "";
      const ratingStr = p.rating?.average ? String(p.rating.average) : "";
      const imgUrl = pick(p.image?.urls, "medium");
      const url = p.slug ? `/products/${encodeURIComponent(p.slug)}` : "#";

      return {
        listKey: key,
        kind: "products",
        index: idx + 1,
        raw: p as unknown as Record<string, unknown>,
        text: {
          id: String(p.id),
          name: p.name,
          price: ctx.formatMoney(p.price),
          old_price: oldPriceStr,
          discount: discountStr,
          rating: ratingStr,
        },
        images: { image: imgUrl },
        links: { url },
        truthy: {
          name: Boolean(p.name),
          price: true,
          old_price: hasOld,
          discount: Boolean(p.discount_percent && p.discount_percent > 0),
          rating: Boolean(p.rating && p.rating.count > 0),
          image: Boolean(imgUrl),
          url: Boolean(p.slug),
        },
      };
    });
  }

  if (fType === "categories") {
    return ctx.categories(key).map((c, idx) => {
      const count = c.count ?? c.products_count ?? 0;
      const imgUrl = typeof c.image === "string" ? c.image : pick(c.image?.urls, "medium");
      const url = c.url ?? (c.slug ? `/categories/${encodeURIComponent(c.slug)}` : "#");

      return {
        listKey: key,
        kind: "categories",
        index: idx + 1,
        raw: c as unknown as Record<string, unknown>,
        text: {
          name: c.name,
          count: String(count),
        },
        images: { image: imgUrl },
        links: { url },
        truthy: {
          name: Boolean(c.name),
          count: count > 0,
          image: Boolean(imgUrl),
          url: Boolean(url && url !== "#"),
        },
      };
    });
  }

  if (fType === "images") {
    const items = ctx.images?.(key) ?? [];
    return items.map((item, idx) => ({
      listKey: key,
      kind: "images",
      index: idx + 1,
      raw: item as unknown as Record<string, unknown>,
      text: { alt: item.alt ?? "" },
      images: { img: item.img },
      links: {},
      truthy: {
        img: Boolean(item.img),
        alt: Boolean(item.alt && item.alt.trim() !== ""),
      },
    }));
  }

  // Default: list field
  const rows = ctx.list(key);
  return rows.map((row, idx) => {
    const text: Record<string, string> = {};
    const textareaKeys = new Set<string>();
    const images: Record<string, string | null> = {};
    const links: Record<string, string | null> = {};
    const truthy: Record<string, boolean> = {};

    for (const [k, v] of Object.entries(row)) {
      if (k.endsWith("_media_id")) {
        const baseKey = k.slice(0, -9);
        const resolvedImg = ctx.listImage ? ctx.listImage(key, idx, baseKey, row) : null;
        images[baseKey] = resolvedImg;
        truthy[baseKey] = Boolean(resolvedImg);
        continue;
      }
      const subType = ctx.fieldType?.(k, key);
      if (subType === "image") {
        const resolvedImg = ctx.listImage ? ctx.listImage(key, idx, k, row) : (typeof v === "string" ? v : null);
        images[k] = resolvedImg;
        truthy[k] = Boolean(resolvedImg);
      } else if (subType === "link") {
        const resolvedLink = ctx.listLink ? ctx.listLink(key, idx, k, row) : (typeof v === "string" ? v : "#");
        links[k] = resolvedLink;
        truthy[k] = Boolean(resolvedLink && resolvedLink !== "#");
      } else if (subType === "toggle") {
        truthy[k] = Boolean(v);
      } else {
        const strVal = v === null || v === undefined ? "" : String(v);
        text[k] = strVal;
        truthy[k] = strVal.trim() !== "";
        if (subType === "textarea") {
          textareaKeys.add(k);
        }
      }
    }

    return {
      listKey: key,
      kind: "list",
      index: idx + 1,
      raw: row,
      text,
      textareaKeys,
      images,
      links,
      truthy,
    };
  });
}
