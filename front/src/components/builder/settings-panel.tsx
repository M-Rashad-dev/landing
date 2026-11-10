"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FieldList } from "@/themes/shared/fields/field-renderer";
import { getTheme } from "@/themes/registry";
import { SCHEMAS } from "@/themes/shared/schemas";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { useBuilder } from "./context";
import { PageIdentity } from "./page-identity";
import { useBuilderCategories } from "./store-data";

const t = ar.builder;

/** Selected section: variant + schema-generated form. Nothing selected: page settings. */
export function SettingsPanel({
  themes,
  identities,
  products,
  onThemeRequest,
  onMetaChange,
  metaSaving,
}: {
  themes: Array<{ key: string; name: string; owned?: boolean }>;
  identities: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string }>;
  onThemeRequest: (themeKey: string) => void;
  onMetaChange: (patch: { identity_id?: number; product_id?: number | null }) => void;
  metaSaving: boolean;
}) {
  const selectedId = useBuilder((s) => s.selectedId);
  const section = useBuilder((s) => s.content.sections.find((x) => x.id === s.selectedId) ?? null);
  const sections = useBuilder((s) => s.content.sections);
  const themeKey = useBuilder((s) => s.themeKey);
  const page = useBuilder((s) => s.page);
  const updateProps = useBuilder((s) => s.updateProps);
  const setVariant = useBuilder((s) => s.setVariant);
  const select = useBuilder((s) => s.select);
  const categories = useBuilderCategories();
  const isStoreHome = page?.kind === "store_home";

  if (!section || !selectedId) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 className="font-bold">{t.pageSettings}</h2>
        <p className="text-sm text-muted-foreground">{t.noSelection}</p>
        {isStoreHome ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-semibold">
              {t.theme}: {getTheme(themeKey).name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{ar.store.home.themeFromStore}</p>
            <Button variant="link" size="sm" className="mt-1 h-auto p-0" asChild>
              <Link href="/dashboard/store">{ar.store.home.openStore}</Link>
            </Button>
          </div>
        ) : (
          <FormField label={t.theme} htmlFor="b-theme">
            <Select id="b-theme" value={themeKey} onChange={(event) => onThemeRequest(event.target.value)} options={themes.map((theme) => ({ value: theme.key, label: theme.name, disabled: theme.owned === false && theme.key !== themeKey, hint: theme.owned === false ? ar.themeStore.locked : undefined }))} />
          </FormField>
        )}
        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-semibold">{t.identity}</h3>
          <PageIdentity identities={identities} metaSaving={metaSaving} onMetaChange={onMetaChange} />
        </div>
        {isStoreHome ? null : (
        <FormField label={t.product} htmlFor="b-product">
          <Select
            id="b-product"
            disabled={metaSaving}
            value={page?.product_id ? String(page.product_id) : ""}
            placeholder={ar.pages.noProduct}
            onChange={(event) => onMetaChange({ product_id: event.target.value ? Number(event.target.value) : null })}
            options={products.map((p) => ({ value: String(p.id), label: p.name }))}
          />
        </FormField>
        )}
        {page && !isStoreHome ? (
          <Button variant="outline" asChild>
            <Link href={`/dashboard/pages/${page.id}`}>{ar.pages.settings}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const schema = SCHEMAS[section.type];
  const def = getTheme(themeKey).components[section.type];
  const Thumb = def.Thumbnail;
  const props = { ...schema.defaults, ...section.props };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => select(null)} aria-label={t.pageSettings}>
          <ArrowRight />
        </Button>
        <h2 className="font-bold">{schema.label}</h2>
      </div>

      <FormField label={t.variant}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.variant}>
          {def.variants.map((variant) => (
            <button
              key={variant.key}
              type="button"
              role="radio"
              aria-checked={section.variant === variant.key}
              onClick={() => setVariant(section.id, variant.key)}
              className={cn("flex flex-col gap-1 rounded-lg border p-2 text-xs font-semibold transition-colors", section.variant === variant.key ? "border-primary bg-secondary text-primary" : "hover:bg-accent")}
            >
              <span className="aspect-[5/3] overflow-hidden rounded bg-muted p-1 text-primary">
                <Thumb />
              </span>
              {variant.label}
            </button>
          ))}
        </div>
      </FormField>

      <FieldList key={section.id} fields={schema.fields} values={props} onChange={(patch) => updateProps(section.id, patch)} ctx={{ sections, idPrefix: `s-${section.id.slice(0, 8)}`, ...(isStoreHome ? { categories } : {}) }} />
    </div>
  );
}
