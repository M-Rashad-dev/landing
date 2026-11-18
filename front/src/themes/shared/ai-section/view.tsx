"use client";

import * as React from "react";
import { formatMoney } from "@/lib/format";
import { pick } from "@/themes/shared/design";
import type { ProductCard } from "@/themes/store/shared/types";
import "./ai-section.css";
import { attachBehaviors } from "./behaviors";
import { placeholderImage, sampleCategories, sampleProducts, sampleValues } from "./sample";
import { renderTemplate, type CategoryRenderItem, type ImageRenderItem, type RenderCtx } from "./template";
import { aiTokensToCssVars } from "./tokens";
import type { AiColorDefault, AiDefinition, AiField, AiFieldType, AiSectionRuntimeData, AiTokens } from "./types";

export type AiSectionViewProps = {
  sectionId?: string;
  definition: AiDefinition | null | undefined;
  values: Record<string, unknown>;
  mode: "live" | "builder" | "preview";
  tokens: AiTokens;
  data?: AiSectionRuntimeData;
  onAdd?: (productId: number) => void;
  sampleMode?: boolean;
};

function defaultColorToken(def: AiColorDefault | undefined, tokens: AiTokens): string {
  switch (def) {
    case "secondary":
      return tokens.secondary;
    case "text":
      return tokens.text;
    case "background":
      return tokens.bg;
    default:
      return tokens.primary;
  }
}

export function AiSectionView({
  sectionId = "preview",
  definition,
  values,
  mode,
  tokens,
  data,
  onAdd,
  sampleMode,
}: AiSectionViewProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const useSamples = sampleMode ?? mode === "builder";

  const fieldMap = React.useMemo(() => {
    const map = new Map<string, AiField>();
    for (const f of definition?.fields ?? []) {
      map.set(f.key, f);
    }
    return map;
  }, [definition]);

  const samples = React.useMemo(
    () => (useSamples && definition ? sampleValues(definition.fields) : {}),
    [useSamples, definition],
  );

  const html = React.useMemo(() => {
    if (!definition) return "";

    const resolveMediaUrl = (mediaId: unknown, fallbackLabel?: string): string | null => {
      if (typeof mediaId === "number" || (typeof mediaId === "string" && mediaId !== "")) {
        const urls = data?.media?.[String(mediaId)];
        const picked = pick(urls, "large") ?? pick(urls, "medium");
        if (picked) return picked;
      }
      return useSamples ? placeholderImage(fallbackLabel ?? definition.name) : null;
    };

    const resolveLandingOrDirectLink = (raw: unknown): string | null => {
      if (!raw || typeof raw !== "object") return useSamples ? "#" : null;
      const linkObj = raw as { type?: string; url?: string | null };
      if (linkObj.type === "order") return "#order";
      if (linkObj.type === "all_products") return "/products";
      if (linkObj.type === "offers") return "/offers";
      if (linkObj.type === "url" && typeof linkObj.url === "string" && linkObj.url.trim() !== "") {
        return linkObj.url.trim();
      }
      return "#";
    };

    const ctx: RenderCtx = {
      fieldType: (key: string, parentListKey?: string): AiFieldType | undefined => {
        if (parentListKey) {
          const parent = fieldMap.get(parentListKey);
          return parent?.fields?.find((s) => s.key === key)?.type;
        }
        return fieldMap.get(key)?.type;
      },
      value: (key: string): unknown => {
        const v = values[key];
        if (v !== undefined && v !== null && v !== "") {
          return v;
        }
        return useSamples ? samples[key] : undefined;
      },
      image: (key: string): string | null => {
        const field = fieldMap.get(key);
        const mediaId =
          values[`${key}_media_id`] ??
          (useSamples
            ? (field?.sample_media_id ?? (typeof field?.sample === "number" ? field.sample : undefined))
            : undefined);
        return resolveMediaUrl(mediaId, field?.label);
      },
      images: (key: string): ImageRenderItem[] => {
        const field = fieldMap.get(key);
        const ids = values[`${key}_media_ids`];
        if (Array.isArray(ids) && ids.length > 0) {
          return ids
            .map((id, i) => {
              const url = resolveMediaUrl(id, `${field?.label ?? "صورة"} ${i + 1}`);
              return url ? { img: url, alt: `${field?.label ?? ""} ${i + 1}`.trim() } : null;
            })
            .filter((x): x is ImageRenderItem => x !== null);
        }
        if (useSamples) {
          const count = typeof field?.sample === "number" ? Math.max(1, Math.min(12, field.sample)) : 4;
          return Array.from({ length: count }, (_, i) => ({
            img: placeholderImage(`${field?.label ?? "صورة"} ${i + 1}`),
            alt: `${field?.label ?? "صورة"} ${i + 1}`,
          }));
        }
        return [];
      },
      link: (key: string): string | null => {
        const serverKey = `${sectionId}:${key}`;
        if (data?.links && serverKey in data.links) {
          return data.links[serverKey] ?? "#";
        }
        return resolveLandingOrDirectLink(values[key]);
      },
      date: (key: string): string | null => {
        const v = values[key];
        if (typeof v === "string" && v.trim() !== "") return v;
        return useSamples && typeof samples[key] === "string" ? (samples[key] as string) : null;
      },
      list: (key: string): Array<Record<string, unknown>> => {
        const v = values[key];
        if (Array.isArray(v) && v.length > 0) {
          return v.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
        }
        if (useSamples && Array.isArray(samples[key])) {
          return samples[key] as Array<Record<string, unknown>>;
        }
        return [];
      },
      listImage: (listKey: string, index: number, subKey: string, item: Record<string, unknown>): string | null => {
        const parent = fieldMap.get(listKey);
        const subField = parent?.fields?.find((s) => s.key === subKey);
        const mediaId = item[`${subKey}_media_id`];
        return resolveMediaUrl(mediaId, `${subField?.label ?? "صورة"} ${index + 1}`);
      },
      listLink: (listKey: string, index: number, subKey: string, item: Record<string, unknown>): string | null => {
        const serverKey = `${sectionId}:${listKey}:${index}:${subKey}`;
        if (data?.links && serverKey in data.links) {
          return data.links[serverKey] ?? "#";
        }
        return resolveLandingOrDirectLink(item[subKey]);
      },
      products: (key: string): ProductCard[] => {
        const serverKey = `${sectionId}:${key}`;
        const list = data?.products?.[serverKey];
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
        if (useSamples) {
          const field = fieldMap.get(key);
          const count = typeof field?.sample === "number" ? field.sample : 4;
          return sampleProducts(count);
        }
        return [];
      },
      categories: (key: string): CategoryRenderItem[] => {
        const serverKey = `${sectionId}:${key}`;
        const list = data?.categories?.[serverKey];
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
        if (useSamples) {
          const field = fieldMap.get(key);
          const count = typeof field?.sample === "number" ? field.sample : 4;
          return sampleCategories(count);
        }
        return [];
      },
      product: data?.landingProduct ?? (useSamples ? {
        name: "منتج تجريبي مميز",
        price: 299,
        compare_at_price: 399,
        image: placeholderImage("صورة المنتج"),
      } : null),
      formatMoney,
    };

    return renderTemplate(definition.html, ctx);
  }, [definition, values, useSamples, samples, fieldMap, data, sectionId]);

  React.useEffect(() => {
    if (mode === "builder" || !rootRef.current) return;
    return attachBehaviors(rootRef.current, {
      onAdd: mode === "live" ? onAdd : undefined,
    });
  }, [mode, html, onAdd]);

  if (!definition) {
    return null;
  }

  const styleVars: Record<string, string> = {
    ...aiTokensToCssVars(tokens),
  };

  for (const field of definition.fields) {
    if (field.type === "color") {
      const raw = values[field.key];
      const hex =
        typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw)
          ? raw
          : defaultColorToken(field.default, tokens);
      styleVars[`--f-${field.key}`] = hex;
    }
  }

  return (
    <div
      ref={rootRef}
      data-ai-v={definition.id}
      data-ai-mode={mode}
      dir="rtl"
      className="ai-section"
      style={styleVars as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: definition.css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

