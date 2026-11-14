"use client";

import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { AddonInput, Input, Textarea } from "@/components/ui/input";
import { TagInput } from "@/components/forms/tag-input";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SEO_LIMITS, type SeoAuto, type SeoValue } from "./seo-model";

const t = ar.catalog.seo;

/**
 * Slug, title, description, keywords (+ hide from Google) with a live Google preview.
 * Every empty field shows its automatic value faded and stays automatic; "رجّعه تلقائي" clears it.
 */
export function SeoFields({
  slug,
  onSlugChange,
  slugAuto,
  slugPrefix,
  slugError,
  seo,
  onSeoChange,
  auto,
  storeUrl,
  storeName,
  showNoindex = false,
}: {
  slug: string;
  onSlugChange: (v: string) => void;
  slugAuto: string;
  slugPrefix: string;
  slugError?: string;
  seo: SeoValue;
  onSeoChange: (v: SeoValue) => void;
  auto: SeoAuto;
  storeUrl: string | null;
  storeName: string;
  showNoindex?: boolean;
}) {
  const set = (patch: Partial<SeoValue>) => onSeoChange({ ...seo, ...patch });
  const title = seo.title?.trim() || auto.title;
  const description = seo.description?.trim() || auto.description;
  const host = storeUrl ? storeUrl.replace(/^https?:\/\//, "") : "";

  return (
    <div className="flex flex-col gap-4">
      <Field label={<AutoLabel text={t.slug} auto={!slug.trim()} />} htmlFor="seo-slug" hint={t.slugHint} error={slugError}>
        <AddonInput id="seo-slug" addon={slugPrefix} value={slug} onChange={(e) => onSlugChange(e.target.value.replace(/\s+/g, "-"))} placeholder={slugAuto} aria-invalid={!!slugError} />
      </Field>

      <Field label={<AutoLabel text={t.metaTitle} auto={!seo.title?.trim()} onReset={seo.title ? () => set({ title: "" }) : undefined} />} htmlFor="seo-title">
        <Input id="seo-title" value={seo.title ?? ""} maxLength={SEO_LIMITS.title} onChange={(e) => set({ title: e.target.value })} placeholder={auto.title} />
        <Counter n={(seo.title || auto.title).length} max={SEO_LIMITS.title} />
      </Field>

      <Field label={<AutoLabel text={t.metaDescription} auto={!seo.description?.trim()} onReset={seo.description ? () => set({ description: "" }) : undefined} />} htmlFor="seo-description">
        <Textarea id="seo-description" rows={3} value={seo.description ?? ""} maxLength={SEO_LIMITS.description} onChange={(e) => set({ description: e.target.value })} placeholder={auto.description} />
        <Counter n={(seo.description || auto.description).length} max={SEO_LIMITS.description} />
      </Field>

      <Field label={<AutoLabel text={t.keywords} auto={!seo.keywords?.length} onReset={seo.keywords?.length ? () => set({ keywords: [] }) : undefined} />} htmlFor="seo-keywords" hint={t.keywordsHint}>
        <TagInput id="seo-keywords" value={seo.keywords ?? []} onChange={(keywords) => set({ keywords })} ghost={auto.keywords} max={SEO_LIMITS.keywords} maxLength={SEO_LIMITS.keyword} placeholder={t.keywordsPlaceholder} removeLabel={t.removeKeyword} />
      </Field>

      {showNoindex ? <SwitchRow title={t.noindex} description={t.noindexHint} checked={!!seo.noindex} onCheckedChange={(noindex) => set({ noindex })} /> : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">{t.preview}</span>
        <div className="rounded-xl border border-border bg-surface p-4" dir="rtl">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-ink-2">{storeName.slice(0, 1)}</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] text-ink">{storeName}</span>
              <span className="block truncate text-xs text-ink-3" dir="ltr">
                {host || "…"} › {slugPrefix.replace(/^\/|\/$/g, "")} › {slug.trim() || slugAuto}
              </span>
            </span>
          </div>
          <p className={cn("mt-2 line-clamp-1 text-lg leading-snug text-info", seo.noindex && "line-through opacity-50")}>{title}</p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-2">{description}</p>
        </div>
      </div>
    </div>
  );
}

function AutoLabel({ text, auto, onReset }: { text: string; auto: boolean; onReset?: () => void }) {
  return (
    <span className="flex flex-1 items-center gap-2">
      {text}
      {auto ? (
        <Badge tone="brand-soft" size="sm" title={t.autoHint}>
          {t.auto}
        </Badge>
      ) : null}
      {onReset ? (
        <Button type="button" variant="link" size="sm" className="ms-auto text-xs font-normal" onClick={onReset}>
          <RotateCcw className="size-3" />
          {t.useAuto}
        </Button>
      ) : null}
    </span>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <span className={cn("tabular self-end text-[11px]", n > max ? "text-danger" : "text-ink-3")} dir="ltr">
      {t.counter(n, max)}
    </span>
  );
}
