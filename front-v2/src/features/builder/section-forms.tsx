"use client";

import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { RadioCards, SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { pathOf, useCategories } from "@/features/catalog/categories/api";
import { ImageField } from "@/features/media/image-fields";
import { MediaPicker } from "@/features/media/media-picker";
import type { MediaItem } from "@/features/media/api";
import { useProductChoices } from "@/features/promotions/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { FEATURE_ICONS } from "@/themes/asas/icons";
import { COLUMNS, ICON_KEYS, pick, PRODUCT_LIMITS, type BannerProps, type FeaturesProps, type LinkType, type MediaUrls, type ProductsProps, type Slide, type TestimonialsProps } from "@/themes/asas/types";

const tb = ar.design.banner;
const tp = ar.design.products;
const tf = ar.design.features;
const tt = ar.design.testimonials;

type Errors = Record<string, string>;
const nullable = (v: string) => (v.trim() === "" ? null : v);

function Card({ title, onUp, onDown, onRemove, removeLabel, children }: { title: string; onUp?: () => void; onDown?: () => void; onRemove?: () => void; removeLabel: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1">
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {onUp ? (
          <Button size="icon-sm" variant="ghost" onClick={onUp} aria-label={ar.design.builder.moveHint}>
            <ArrowUp />
          </Button>
        ) : null}
        {onDown ? (
          <Button size="icon-sm" variant="ghost" onClick={onDown} aria-label={ar.design.builder.moveHint}>
            <ArrowDown />
          </Button>
        ) : null}
        {onRemove ? (
          <Button size="icon-sm" variant="danger-ghost" onClick={onRemove} aria-label={removeLabel}>
            <Trash2 />
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* ---------- بنر ---------- */

export function BannerForm({ props, onChange, errors, media, onMedia }: { props: BannerProps; onChange: (p: BannerProps) => void; errors: Errors; media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void }) {
  const categories = useCategories();
  const products = useProductChoices();
  const setSlide = (i: number, patch: Partial<Slide>) => onChange({ ...props, slides: props.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setLink = (i: number, patch: Partial<Slide["link"]>) => setSlide(i, { link: { ...props.slides[i].link, ...patch } });
  const [picking, setPicking] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-3">{tb.slidesHint}</p>
      {props.slides.map((slide, i) => {
        const url = pick(media[String(slide.media_id)], "thumb");
        const e = (k: string) => errors[`slides.${i}.${k}`];
        return (
          <Card
            key={i}
            title={tb.slide(i + 1)}
            removeLabel={tb.remove}
            onUp={i > 0 ? () => onChange({ ...props, slides: move(props.slides, i, i - 1) }) : undefined}
            onDown={i < props.slides.length - 1 ? () => onChange({ ...props, slides: move(props.slides, i, i + 1) }) : undefined}
            onRemove={() => onChange({ ...props, slides: props.slides.filter((_, j) => j !== i) })}
          >
            <Field label={tb.image} error={e("media_id")}>
              <ImageField
                value={url ? { id: slide.media_id, url } : null}
                onChange={(item) => {
                  if (!item) return;
                  onMedia(item);
                  setSlide(i, { media_id: item.id });
                }}
              />
            </Field>
            <Field label={tb.title} htmlFor={`sl-title-${i}`} error={e("title")} optional>
              <Input id={`sl-title-${i}`} maxLength={80} value={slide.title ?? ""} onChange={(ev) => setSlide(i, { title: nullable(ev.target.value) })} />
            </Field>
            <Field label={tb.text} htmlFor={`sl-text-${i}`} error={e("text")} optional>
              <Textarea id={`sl-text-${i}`} rows={2} maxLength={200} value={slide.text ?? ""} onChange={(ev) => setSlide(i, { text: nullable(ev.target.value) })} />
            </Field>
            <Field label={tb.buttonLabel} htmlFor={`sl-btn-${i}`} hint={tb.buttonHint} error={e("button_label")} optional>
              <Input id={`sl-btn-${i}`} maxLength={30} value={slide.button_label ?? ""} onChange={(ev) => setSlide(i, { button_label: nullable(ev.target.value) })} />
            </Field>
            <Field label={tb.link} error={e("link.type")}>
              <Select
                value={slide.link.type}
                onValueChange={(v) => setLink(i, { type: v as LinkType, target_id: null, url: null })}
                options={(Object.keys(tb.linkTypes) as LinkType[]).map((k) => ({ value: k, label: tb.linkTypes[k] }))}
                searchable={false}
              />
            </Field>
            {slide.link.type === "category" ? (
              <Field label={tb.pickCategory} error={e("link.target_id")}>
                <Select
                  value={slide.link.target_id ? String(slide.link.target_id) : ""}
                  onValueChange={(v) => setLink(i, { target_id: v ? Number(v) : null })}
                  options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name, hint: pathOf(categories.data ?? [], c) || undefined }))}
                  placeholder={tb.pickCategory}
                />
              </Field>
            ) : null}
            {slide.link.type === "product" ? (
              <Field label={tb.pickProduct} error={e("link.target_id")}>
                <Select value={slide.link.target_id ? String(slide.link.target_id) : ""} onValueChange={(v) => setLink(i, { target_id: v ? Number(v) : null })} options={(products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))} placeholder={tb.pickProduct} />
              </Field>
            ) : null}
            {slide.link.type === "url" ? (
              <Field label={tb.url} error={e("link.url")}>
                <Input dir="ltr" maxLength={500} placeholder="https://" value={slide.link.url ?? ""} onChange={(ev) => setLink(i, { url: ev.target.value })} />
              </Field>
            ) : null}
          </Card>
        );
      })}
      {props.slides.length < 8 ? (
        <>
          <Button variant="outline" onClick={() => setPicking(true)}>
            <Plus />
            {tb.add}
          </Button>
          <MediaPicker
            open={picking}
            onOpenChange={setPicking}
            max={8 - props.slides.length}
            onPick={(items) => {
              items.forEach(onMedia);
              onChange({ ...props, slides: [...props.slides, ...items.map((item) => ({ media_id: item.id, title: null, text: null, button_label: null, link: { type: "none" as const, target_id: null, url: null } }))] });
            }}
          />
        </>
      ) : null}
      {errors.slides ? <p className="text-xs text-danger">{errors.slides}</p> : null}
      <SwitchRow title={tb.autoplay} description={tb.autoplayHint} checked={props.autoplay} onCheckedChange={(v) => onChange({ ...props, autoplay: v })} />
    </div>
  );
}

/* ---------- قائمة منتجات ---------- */

export function ProductsForm({ props, onChange, errors }: { props: ProductsProps; onChange: (p: ProductsProps) => void; errors: Errors }) {
  const categories = useCategories();
  const set = (patch: Partial<ProductsProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Field label={tp.title} htmlFor={"pl-title"} error={errors.title} required>
        <Input id={"pl-title"} maxLength={80} value={props.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label={tp.description} htmlFor={"pl-description"} hint={tp.descriptionHint} error={errors.description} optional>
        <Input id={"pl-description"} maxLength={200} value={props.description ?? ""} onChange={(e) => set({ description: nullable(e.target.value) })} />
      </Field>
      <Field label={tp.source} error={errors.source}>
        <Segmented value={props.source} onChange={(v) => set({ source: v, category_id: v === "category" ? props.category_id : null })} options={(["latest", "offers", "category"] as const).map((k) => ({ value: k, label: tp.sources[k] }))} />
      </Field>
      {props.source === "category" ? (
        <Field label={tp.category} error={errors.category_id} required>
          <Select
            value={props.category_id ? String(props.category_id) : ""}
            onValueChange={(v) => set({ category_id: v ? Number(v) : null })}
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name, hint: pathOf(categories.data ?? [], c) || undefined }))}
            placeholder={tp.category}
          />
        </Field>
      ) : null}
      <Field label={tp.limit} error={errors.limit}>
        <Segmented value={String(props.limit)} onChange={(v) => set({ limit: Number(v) })} options={PRODUCT_LIMITS.map((n) => ({ value: String(n), label: String(n) }))} />
      </Field>
      <Field label={tp.layout} error={errors.layout}>
        <Segmented value={props.layout} onChange={(v) => set({ layout: v })} options={(["grid", "slider"] as const).map((k) => ({ value: k, label: tp.layouts[k] }))} />
      </Field>
      <Field label={tp.columns} hint={tp.columnsHint} error={errors.columns}>
        <Segmented value={String(props.columns)} onChange={(v) => set({ columns: Number(v) })} options={COLUMNS.map((n) => ({ value: String(n), label: String(n) }))} />
      </Field>
      <SwitchRow title={tp.viewAll} description={tp.viewAllHint} checked={props.show_view_all} onCheckedChange={(v) => set({ show_view_all: v })} />
    </div>
  );
}

/* ---------- مميزات المتجر ---------- */

export function FeaturesForm({ props, onChange, errors }: { props: FeaturesProps; onChange: (p: FeaturesProps) => void; errors: Errors }) {
  const setItem = (i: number, patch: Partial<FeaturesProps["items"][number]>) => onChange({ ...props, items: props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-4">
      <Field label={tf.title} htmlFor={"ft-title"} error={errors.title} optional>
        <Input id={"ft-title"} maxLength={80} value={props.title ?? ""} onChange={(e) => onChange({ ...props, title: nullable(e.target.value) })} />
      </Field>
      <p className="text-xs text-ink-3">{tf.itemsHint}</p>
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={tf.item(i + 1)}
          removeLabel={tf.remove}
          onUp={i > 0 ? () => onChange({ ...props, items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => onChange({ ...props, items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 2 ? () => onChange({ ...props, items: props.items.filter((_, j) => j !== i) }) : undefined}
        >
          <Field label={tf.icon}>
            <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={tf.icon}>
              {ICON_KEYS.map((key) => {
                const Icon = FEATURE_ICONS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={item.icon === key}
                    aria-label={key}
                    onClick={() => setItem(i, { icon: key })}
                    className={cn("flex size-9 items-center justify-center rounded-md border", item.icon === key ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-ink-2 hover:bg-surface-2")}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={tf.itemTitle} htmlFor={`ft-title-${i}`} error={errors[`items.${i}.title`]} required>
            <Input id={`ft-title-${i}`} maxLength={40} value={item.title} onChange={(e) => setItem(i, { title: e.target.value })} />
          </Field>
          <Field label={tf.itemText} htmlFor={`ft-text-${i}`} error={errors[`items.${i}.text`]} optional>
            <Input id={`ft-text-${i}`} maxLength={120} value={item.text ?? ""} onChange={(e) => setItem(i, { text: nullable(e.target.value) })} />
          </Field>
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      {props.items.length < 4 ? (
        <Button variant="outline" onClick={() => onChange({ ...props, items: [...props.items, { icon: "star", title: ar.design.builder.defaults.featureTitle, text: null }] })}>
          <Plus />
          {tf.add}
        </Button>
      ) : null}
    </div>
  );
}

/* ---------- آراء العملاء ---------- */

export function TestimonialsForm({ props, onChange, errors }: { props: TestimonialsProps; onChange: (p: TestimonialsProps) => void; errors: Errors }) {
  const setItem = (i: number, patch: Partial<TestimonialsProps["items"][number]>) => onChange({ ...props, items: props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-4">
      <Field label={tt.title} htmlFor={"rv-title"} error={errors.title} optional>
        <Input id={"rv-title"} maxLength={80} value={props.title ?? ""} onChange={(e) => onChange({ ...props, title: nullable(e.target.value) })} />
      </Field>
      <Field label={tt.source}>
        <RadioCards
          className="sm:grid-cols-1"
          value={props.source}
          onValueChange={(v) => onChange({ ...props, source: v as TestimonialsProps["source"], items: v === "manual" && props.items.length === 0 ? [{ name: "", rating: 5, text: "" }] : props.items })}
          options={(["auto", "manual"] as const).map((k) => ({ value: k, title: tt.sources[k].title, description: tt.sources[k].description }))}
        />
      </Field>
      {props.source === "auto" ? (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">{tt.autoNote}</p>
      ) : (
        <>
          {props.items.map((item, i) => (
            <Card
              key={i}
              title={tt.item(i + 1)}
              removeLabel={tt.remove}
              onUp={i > 0 ? () => onChange({ ...props, items: move(props.items, i, i - 1) }) : undefined}
              onDown={i < props.items.length - 1 ? () => onChange({ ...props, items: move(props.items, i, i + 1) }) : undefined}
              onRemove={props.items.length > 1 ? () => onChange({ ...props, items: props.items.filter((_, j) => j !== i) }) : undefined}
            >
              <Field label={tt.name} htmlFor={`rv-name-${i}`} error={errors[`items.${i}.name`]} required>
                <Input id={`rv-name-${i}`} maxLength={60} value={item.name} onChange={(e) => setItem(i, { name: e.target.value })} />
              </Field>
              <Field label={tt.rating}>
                <div className="flex gap-1" role="radiogroup" aria-label={tt.rating}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={item.rating === n} aria-label={tt.stars(n)} onClick={() => setItem(i, { rating: n })} className="p-0.5">
                      <Star className={cn("size-5", n <= item.rating ? "fill-accent text-accent" : "text-ink-3")} />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={tt.text} htmlFor={`rv-text-${i}`} error={errors[`items.${i}.text`]} required>
                <Textarea id={`rv-text-${i}`} rows={3} maxLength={400} value={item.text} onChange={(e) => setItem(i, { text: e.target.value })} />
              </Field>
            </Card>
          ))}
          {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
          {props.items.length < 12 ? (
            <Button variant="outline" onClick={() => onChange({ ...props, items: [...props.items, { name: "", rating: 5, text: "" }] })}>
              <Plus />
              {tt.add}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
