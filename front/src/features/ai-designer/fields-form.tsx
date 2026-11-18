"use client";

import { Plus, RotateCcw, Sparkles } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { MultiSelect, Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { LinkField } from "@/features/builder/library-forms";
import { Card, move } from "@/features/builder/section-forms";
import { pathOf, useCategories } from "@/features/catalog/categories/api";
import type { MediaItem } from "@/features/media/api";
import { ImageField, ImageGallery } from "@/features/media/image-fields";
import { useProductChoices } from "@/features/promotions/api";
import { ar } from "@/messages/ar";
import type { AiDefinition, AiField } from "@/themes/shared/ai-section/types";
import { pick, type MediaUrls } from "@/themes/shared/design";
import { PRODUCT_LIMITS } from "@/themes/store/asas/types";
import type { Link } from "@/themes/store/sufi/types";

const t = ar.aiDesigner;
const s = ar.design.sufi;

const DEFAULT_STORE_LINK: Link = { type: "none", target_id: null, url: null };

type LandingLink = {
  type: "none" | "order" | "url";
  url: string | null;
};

const DEFAULT_LANDING_LINK: LandingLink = { type: "none", url: null };

type ProductsValue = {
  source: "latest" | "offers" | "category" | "manual";
  category_id: number | null;
  product_ids: number[];
  limit: number;
};

const DEFAULT_PRODUCTS_VALUE: ProductsValue = {
  source: "latest",
  category_id: null,
  product_ids: [],
  limit: 8,
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function readError(errors: Record<string, string>, path: string): string | undefined {
  return errors[`values.${path}`] ?? errors[path];
}

function subErrorsFor(errors: Record<string, string>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  const fullPrefix = `values.${prefix}.`;
  const shortPrefix = `${prefix}.`;
  for (const [k, v] of Object.entries(errors)) {
    if (k.startsWith(fullPrefix)) {
      out[`${prefix}.${k.slice(fullPrefix.length)}`] = v;
    } else if (k.startsWith(shortPrefix)) {
      out[k] = v;
    }
  }
  return out;
}

export type AiFieldsFormProps = {
  fields: AiField[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  kind: "store" | "landing";
  errors: Record<string, string>;
  media: Record<string, MediaUrls>;
  onMedia: (item: MediaItem) => void;
};

export function AiFieldsForm({
  fields,
  values,
  onChange,
  kind,
  errors,
  media,
  onMedia,
}: AiFieldsFormProps) {
  if (fields.length === 0) {
    return <p className="text-sm text-ink-3">{t.fields.empty}</p>;
  }

  const setKey = (key: string, val: unknown) => {
    const next = { ...values };
    if (val === undefined || val === null) {
      delete next[key];
    } else {
      next[key] = val;
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          pathPrefix=""
          values={values}
          onSetKey={setKey}
          kind={kind}
          errors={errors}
          media={media}
          onMedia={onMedia}
        />
      ))}
    </div>
  );
}

function FieldControl({
  field,
  pathPrefix,
  values,
  onSetKey,
  kind,
  errors,
  media,
  onMedia,
}: {
  field: AiField;
  pathPrefix: string;
  values: Record<string, unknown>;
  onSetKey: (key: string, val: unknown) => void;
  kind: "store" | "landing";
  errors: Record<string, string>;
  media: Record<string, MediaUrls>;
  onMedia: (item: MediaItem) => void;
}) {
  const path = pathPrefix ? `${pathPrefix}.${field.key}` : field.key;
  const err = readError(errors, path);

  switch (field.type) {
    case "text": {
      const val = typeof values[field.key] === "string" ? (values[field.key] as string) : "";
      const placeholder = typeof field.sample === "string" ? field.sample : field.label;
      return (
        <Field label={field.label} hint={field.hint} error={err} optional>
          <Input
            maxLength={field.max ?? 120}
            value={val}
            placeholder={placeholder}
            onChange={(e) => onSetKey(field.key, e.target.value === "" ? undefined : e.target.value)}
          />
        </Field>
      );
    }

    case "textarea": {
      const val = typeof values[field.key] === "string" ? (values[field.key] as string) : "";
      const placeholder = typeof field.sample === "string" ? field.sample : field.label;
      return (
        <Field label={field.label} hint={field.hint} error={err} optional>
          <Textarea
            rows={3}
            maxLength={field.max ?? 600}
            value={val}
            placeholder={placeholder}
            onChange={(e) => onSetKey(field.key, e.target.value === "" ? undefined : e.target.value)}
          />
        </Field>
      );
    }

    case "image": {
      const mediaKey = `${field.key}_media_id`;
      const mediaPath = pathPrefix ? `${pathPrefix}.${mediaKey}` : mediaKey;
      const mediaErr = readError(errors, mediaPath);
      const id = typeof values[mediaKey] === "number" ? (values[mediaKey] as number) : null;
      const url = id ? pick(media[String(id)], "thumb") : null;
      return (
        <Field label={field.label} hint={field.hint} error={mediaErr} optional>
          <ImageField
            value={id && url ? { id, url } : null}
            onChange={(item) => {
              if (item) onMedia(item);
              onSetKey(mediaKey, item ? item.id : undefined);
            }}
          />
        </Field>
      );
    }

    case "images": {
      const mediaKey = `${field.key}_media_ids`;
      const mediaPath = pathPrefix ? `${pathPrefix}.${mediaKey}` : mediaKey;
      const mediaErr = readError(errors, mediaPath);
      const rawIds = Array.isArray(values[mediaKey]) ? (values[mediaKey] as number[]) : [];
      const items: MediaItem[] = rawIds
        .map((id) => {
          const urls = media[String(id)];
          if (!urls) return null;
          return {
            id,
            alt: null,
            width: null,
            height: null,
            mime: "image/webp",
            size_bytes: 0,
            urls: {
              thumb: pick(urls, "thumb") ?? "",
              medium: pick(urls, "medium") ?? "",
              large: pick(urls, "large") ?? "",
            },
            created_at: "",
          };
        })
        .filter((x): x is MediaItem => x !== null && x.urls.thumb !== "");

      return (
        <Field label={field.label} hint={field.hint} error={mediaErr} optional>
          <ImageGallery
            value={items}
            max={field.max ?? 8}
            onChange={(picked) => {
              picked.forEach(onMedia);
              onSetKey(
                mediaKey,
                picked.length > 0 ? picked.map((p) => p.id) : undefined,
              );
            }}
          />
        </Field>
      );
    }

    case "link": {
      if (kind === "store") {
        const raw =
          typeof values[field.key] === "object" && values[field.key] !== null
            ? (values[field.key] as Link)
            : DEFAULT_STORE_LINK;
        return (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <span className="text-xs font-semibold text-ink-2">{field.label}</span>
            <LinkField
              value={{
                type: raw.type ?? "none",
                target_id: raw.target_id ?? null,
                url: raw.url ?? null,
              }}
              onChange={(l) => onSetKey(field.key, l)}
              errors={subErrorsFor(errors, path)}
              prefix={path}
            />
          </div>
        );
      }

      const raw =
        typeof values[field.key] === "object" && values[field.key] !== null
          ? (values[field.key] as LandingLink)
          : DEFAULT_LANDING_LINK;
      const typeErr = readError(errors, `${path}.type`);
      const urlErr = readError(errors, `${path}.url`);

      return (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <Field label={field.label} hint={field.hint} error={typeErr}>
            <Select
              value={raw.type ?? "none"}
              onValueChange={(v) =>
                onSetKey(field.key, {
                  type: v as LandingLink["type"],
                  url: v === "url" ? (raw.url ?? "") : null,
                })
              }
              options={(["none", "order", "url"] as const).map((k) => ({
                value: k,
                label: t.fields.linkTypes[k],
              }))}
              searchable={false}
            />
          </Field>
          {raw.type === "url" ? (
            <Field label={t.fields.link} error={urlErr}>
              <Input
                dir="ltr"
                maxLength={500}
                placeholder={t.fields.urlPlaceholder}
                value={raw.url ?? ""}
                onChange={(e) =>
                  onSetKey(field.key, {
                    ...raw,
                    url: e.target.value,
                  })
                }
              />
            </Field>
          ) : null}
        </div>
      );
    }

    case "color": {
      const val =
        typeof values[field.key] === "string" && /^#[0-9a-fA-F]{6}$/.test(values[field.key] as string)
          ? (values[field.key] as string)
          : null;
      return (
        <Field label={field.label} hint={field.hint} error={err} optional>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={val ?? "#0b875b"}
              onChange={(e) => onSetKey(field.key, e.target.value.toLowerCase())}
              className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface p-0.5"
              aria-label={field.label}
            />
            <span className="text-xs text-ink-3" dir="ltr">
              {val ?? t.fields.themeColor}
            </span>
            {val ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSetKey(field.key, undefined)}
              >
                <RotateCcw className="size-3.5" />
                {t.fields.resetColor}
              </Button>
            ) : null}
          </div>
        </Field>
      );
    }

    case "number": {
      const raw = values[field.key];
      const strVal = typeof raw === "number" ? String(raw) : "";
      const placeholder = typeof field.sample === "number" ? String(field.sample) : undefined;
      return (
        <Field label={field.label} hint={field.hint} error={err} optional>
          <Input
            type="number"
            dir="ltr"
            min={field.min ?? -100000}
            max={field.max ?? 100000}
            value={strVal}
            placeholder={placeholder}
            onChange={(e) => {
              const v = e.target.value;
              onSetKey(field.key, v === "" ? undefined : Number(v));
            }}
          />
        </Field>
      );
    }

    case "toggle": {
      const checked =
        typeof values[field.key] === "boolean"
          ? (values[field.key] as boolean)
          : typeof field.sample === "boolean"
            ? field.sample
            : true;
      return (
        <SwitchRow
          title={field.label}
          description={field.hint}
          checked={checked}
          onCheckedChange={(v) => onSetKey(field.key, v)}
        />
      );
    }

    case "date": {
      const iso = typeof values[field.key] === "string" ? (values[field.key] as string) : null;
      return (
        <Field label={field.label} hint={field.hint} error={err} optional>
          <Input
            type="datetime-local"
            dir="ltr"
            value={toLocalInput(iso)}
            onChange={(e) =>
              onSetKey(
                field.key,
                e.target.value ? new Date(e.target.value).toISOString() : undefined,
              )
            }
          />
        </Field>
      );
    }

    case "products": {
      return (
        <ProductsFieldControl
          field={field}
          path={path}
          value={values[field.key]}
          onChange={(v) => onSetKey(field.key, v)}
          errors={errors}
        />
      );
    }

    case "categories": {
      return (
        <CategoriesFieldControl
          field={field}
          path={path}
          value={values[field.key]}
          onChange={(v) => onSetKey(field.key, v)}
          errors={errors}
        />
      );
    }

    case "list": {
      return (
        <ListFieldControl
          field={field}
          path={path}
          value={values[field.key]}
          onChange={(v) => onSetKey(field.key, v)}
          kind={kind}
          errors={errors}
          media={media}
          onMedia={onMedia}
        />
      );
    }

    default:
      return null;
  }
}

function ProductsFieldControl({
  field,
  path,
  value,
  onChange,
  errors,
}: {
  field: AiField;
  path: string;
  value: unknown;
  onChange: (val: ProductsValue) => void;
  errors: Record<string, string>;
}) {
  const categories = useCategories();
  const products = useProductChoices();
  const current: ProductsValue =
    typeof value === "object" && value !== null
      ? {
          ...DEFAULT_PRODUCTS_VALUE,
          ...(value as Partial<ProductsValue>),
        }
      : DEFAULT_PRODUCTS_VALUE;

  const set = (patch: Partial<ProductsValue>) => onChange({ ...current, ...patch });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <span className="text-xs font-semibold text-ink-2">{field.label}</span>
      {field.hint ? <p className="text-xs text-ink-3">{field.hint}</p> : null}
      <Field label={t.fields.productsSource} error={readError(errors, `${path}.source`)}>
        <Select
          value={current.source}
          onValueChange={(v) =>
            set({
              source: v as ProductsValue["source"],
              category_id: null,
              product_ids: [],
            })
          }
          options={(["latest", "offers", "category", "manual"] as const).map((k) => ({
            value: k,
            label: s.tabs.sources[k],
          }))}
          searchable={false}
        />
      </Field>
      {current.source === "category" ? (
        <Field label={s.tabs.category} error={readError(errors, `${path}.category_id`)} required>
          <Select
            value={current.category_id ? String(current.category_id) : ""}
            onValueChange={(v) => set({ category_id: v ? Number(v) : null })}
            options={(categories.data ?? []).map((c) => ({
              value: String(c.id),
              label: c.name,
              hint: pathOf(categories.data ?? [], c) || undefined,
            }))}
            placeholder={s.tabs.category}
          />
        </Field>
      ) : null}
      {current.source === "manual" ? (
        <Field label={s.tabs.products} error={readError(errors, `${path}.product_ids`)} required>
          <MultiSelect
            value={(current.product_ids ?? []).map(String)}
            onChange={(v) => set({ product_ids: v.map(Number) })}
            options={(products.data ?? []).map((p) => ({
              value: String(p.id),
              label: p.name,
            }))}
            placeholder={s.tabs.products}
          />
        </Field>
      ) : null}
      <Field label={t.fields.productsLimit}>
        <Segmented
          value={String(current.limit ?? 8)}
          onChange={(v) => set({ limit: Number(v) })}
          options={PRODUCT_LIMITS.map((n) => ({ value: String(n), label: String(n) }))}
        />
      </Field>
    </div>
  );
}

function CategoriesFieldControl({
  field,
  path,
  value,
  onChange,
  errors,
}: {
  field: AiField;
  path: string;
  value: unknown;
  onChange: (val: { category_ids: number[] }) => void;
  errors: Record<string, string>;
}) {
  const categories = useCategories();
  const ids =
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { category_ids?: unknown }).category_ids)
      ? ((value as { category_ids: number[] }).category_ids ?? [])
      : [];

  return (
    <Field
      label={field.label}
      hint={field.hint ?? t.fields.categoriesHint}
      error={readError(errors, `${path}.category_ids`)}
    >
      <MultiSelect
        value={ids.map(String)}
        onChange={(v) => onChange({ category_ids: v.map(Number) })}
        options={(categories.data ?? []).map((c) => ({
          value: String(c.id),
          label: c.name,
          hint: pathOf(categories.data ?? [], c) || undefined,
        }))}
        placeholder={t.fields.categoriesPick}
      />
    </Field>
  );
}

function ListFieldControl({
  field,
  path,
  value,
  onChange,
  kind,
  errors,
  media,
  onMedia,
}: {
  field: AiField;
  path: string;
  value: unknown;
  onChange: (val: Array<Record<string, unknown>>) => void;
  kind: "store" | "landing";
  errors: Record<string, string>;
  media: Record<string, MediaUrls>;
  onMedia: (item: MediaItem) => void;
}) {
  const max = field.max ?? 6;
  const subFields = field.fields ?? [];
  const items: Array<Record<string, unknown>> = Array.isArray(value)
    ? value.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    : Array.isArray(field.sample)
      ? (field.sample as Array<Record<string, unknown>>)
      : [];

  const updateItem = (idx: number, key: string, val: unknown) => {
    const next = items.map((row, i) => {
      if (i !== idx) return row;
      const copy = { ...row };
      if (val === undefined || val === null) {
        delete copy[key];
      } else {
        copy[key] = val;
      }
      return copy;
    });
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-2">{field.label}</span>
        <span className="text-xs text-ink-3">
          {items.length} / {max}
        </span>
      </div>
      {field.hint ? <p className="text-xs text-ink-3">{field.hint}</p> : null}
      {items.map((item, idx) => (
        <Card
          key={idx}
          title={t.fields.listItem(idx + 1)}
          removeLabel={t.fields.listRemove}
          onUp={idx > 0 ? () => onChange(move(items, idx, idx - 1)) : undefined}
          onDown={idx < items.length - 1 ? () => onChange(move(items, idx, idx + 1)) : undefined}
          onRemove={items.length > 1 ? () => onChange(items.filter((_, j) => j !== idx)) : undefined}
        >
          {subFields.map((sub) => (
            <FieldControl
              key={sub.key}
              field={sub}
              pathPrefix={`${path}.${idx}`}
              values={item}
              onSetKey={(k, v) => updateItem(idx, k, v)}
              kind={kind}
              errors={errors}
              media={media}
              onMedia={onMedia}
            />
          ))}
        </Card>
      ))}
      {items.length < max ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, {}])}
        >
          <Plus className="size-4" />
          {t.fields.listAdd}
        </Button>
      ) : null}
    </div>
  );
}

export function AiSectionInspector({
  definition,
  values,
  onChange,
  kind,
  errors,
  media,
  onMedia,
  onEditWithAi,
  showEditWithAi = false,
}: {
  definition: AiDefinition | null | undefined;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  kind: "store" | "landing";
  errors: Record<string, string>;
  media: Record<string, MediaUrls>;
  onMedia: (item: MediaItem) => void;
  onEditWithAi?: () => void;
  showEditWithAi?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-pink-50/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold text-ink">
            {definition?.name ?? ar.design.builder.types.ai.title}
          </span>
          <Badge tone="brand" size="sm">
            {t.mySections.badge}
          </Badge>
        </div>
        {showEditWithAi && onEditWithAi ? (
          <Button type="button" size="sm" variant="outline" onClick={onEditWithAi}>
            <Sparkles className="size-4 text-violet-600" />
            {t.editWithAi}
          </Button>
        ) : null}
      </div>

      {definition ? (
        <AiFieldsForm
          fields={definition.fields}
          values={values}
          onChange={onChange}
          kind={kind}
          errors={errors}
          media={media}
          onMedia={onMedia}
        />
      ) : null}
    </div>
  );
}
