"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { MultiSelect, Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { pathOf, useCategories } from "@/features/catalog/categories/api";
import { ImageField } from "@/features/media/image-fields";
import { MediaPicker } from "@/features/media/media-picker";
import type { MediaItem } from "@/features/media/api";
import { useProductChoices } from "@/features/promotions/api";
import { ar } from "@/messages/ar";
import { pick, type MediaUrls } from "@/themes/shared/design";
import { PRODUCT_LIMITS, type LinkType } from "@/themes/store/asas/types";
import type { BannersProps, BrandsProps, CategoriesProps, CountdownProps, FaqProps, FeaturedProps, GalleryProps, HeroProps, Link, LocationProps, MarqueeProps, StoryProps, SufiSection, TabsProps, VideoProps } from "@/themes/store/sufi/types";
import { BannerForm, Card, move, nullable } from "./section-forms";

const s = ar.design.sufi;
const tb = ar.design.banner;
export type Errors = Record<string, string>;
export type Media = { media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void };
const NONE: Link = { type: "none", target_id: null, url: null };

/* ---------- shared pieces ---------- */

export function ImagePick({ id, onChange, media, onMedia, error, label = s.image, optional = false }: { id: number | null; onChange: (id: number | null) => void; error?: string; label?: string; optional?: boolean } & Media) {
  const url = id ? pick(media[String(id)], "thumb") : null;
  return (
    <Field label={label} error={error} optional={optional}>
      <ImageField
        value={id && url ? { id, url } : null}
        onChange={(item) => {
          if (item) onMedia(item);
          onChange(item ? item.id : null);
        }}
      />
    </Field>
  );
}

/** Where a button or a picture leads: nothing, all products, offers, a category, a product, or a link. */
export function LinkField({ value, onChange, errors, prefix }: { value: Link; onChange: (l: Link) => void; errors: Errors; prefix: string }) {
  const categories = useCategories();
  const products = useProductChoices();
  return (
    <>
      <Field label={s.link} error={errors[`${prefix}.type`]}>
        <Select value={value.type} onValueChange={(v) => onChange({ type: v as LinkType, target_id: null, url: null })} options={(Object.keys(tb.linkTypes) as LinkType[]).map((k) => ({ value: k, label: tb.linkTypes[k] }))} searchable={false} />
      </Field>
      {value.type === "category" ? (
        <Field label={tb.pickCategory} error={errors[`${prefix}.target_id`]}>
          <Select value={value.target_id ? String(value.target_id) : ""} onValueChange={(v) => onChange({ ...value, target_id: v ? Number(v) : null })} options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name, hint: pathOf(categories.data ?? [], c) || undefined }))} placeholder={tb.pickCategory} />
        </Field>
      ) : null}
      {value.type === "product" ? (
        <Field label={tb.pickProduct} error={errors[`${prefix}.target_id`]}>
          <Select value={value.target_id ? String(value.target_id) : ""} onValueChange={(v) => onChange({ ...value, target_id: v ? Number(v) : null })} options={(products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))} placeholder={tb.pickProduct} />
        </Field>
      ) : null}
      {value.type === "url" ? (
        <Field label={tb.url} error={errors[`${prefix}.url`]}>
          <Input dir="ltr" maxLength={500} placeholder="https://" value={value.url ?? ""} onChange={(e) => onChange({ ...value, url: e.target.value })} />
        </Field>
      ) : null}
      {value.type === "search" ? (
        <Field label={tb.searchWord} hint={tb.searchWordHint} error={errors[`${prefix}.url`]}>
          <Input maxLength={60} value={value.url ?? ""} onChange={(e) => onChange({ ...value, url: e.target.value })} />
        </Field>
      ) : null}
    </>
  );
}

export function Text({ id, label, value, onChange, error, max, required = false, area = false, hint }: { id: string; label: string; value: string | null; onChange: (v: string | null) => void; error?: string; max: number; required?: boolean; area?: boolean; hint?: string }) {
  return (
    <Field label={label} htmlFor={id} error={error} required={required} optional={!required} hint={hint}>
      {area ? (
        <Textarea id={id} rows={3} maxLength={max} value={value ?? ""} onChange={(e) => onChange(required ? e.target.value : nullable(e.target.value))} />
      ) : (
        <Input id={id} maxLength={max} value={value ?? ""} onChange={(e) => onChange(required ? e.target.value : nullable(e.target.value))} />
      )}
    </Field>
  );
}

function Heading({ title, description, onChange, errors }: { title: string | null; description?: string | null; onChange: (patch: { title?: string | null; description?: string | null }) => void; errors: Errors }) {
  return (
    <>
      <Text id="sf-title" label={s.title} value={title} onChange={(v) => onChange({ title: v })} error={errors.title} max={80} />
      {description !== undefined ? <Text id="sf-description" label={s.description} value={description} onChange={(v) => onChange({ description: v })} error={errors.description} max={200} /> : null}
    </>
  );
}

/** Adds pictures from the library as new items. */
function AddImages({ label, max, onPick, onMedia }: { label: string; max: number; onPick: (items: MediaItem[]) => void; onMedia: (item: MediaItem) => void }) {
  const [open, setOpen] = React.useState(false);
  if (max <= 0) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus />
        {label}
      </Button>
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        max={max}
        onPick={(items) => {
          items.forEach(onMedia);
          onPick(items);
        }}
      />
    </>
  );
}

/* ---------- sections ---------- */

function HeroForm({ props, onChange, errors, media, onMedia }: { props: HeroProps; onChange: (p: HeroProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<HeroProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="hero-kicker" label={s.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <BannerForm props={props} onChange={(b) => onChange({ ...props, ...b })} errors={errors} media={media} onMedia={onMedia} />
      <Field label={s.hero.height}>
        <Segmented value={props.height} onChange={(v) => set({ height: v })} options={(["full", "large", "medium"] as const).map((k) => ({ value: k, label: s.hero.heights[k] }))} />
      </Field>
      <SwitchRow title={s.hero.merge} description={s.hero.mergeHint} checked={props.merge_header} onCheckedChange={(v) => set({ merge_header: v })} />
      <Field label={s.hero.shade} hint={s.hero.shadeHint(props.shade)}>
        <input type="range" min={0} max={80} step={5} value={props.shade} onChange={(e) => set({ shade: Number(e.target.value) })} className="w-full accent-(--brand)" aria-label={s.hero.shade} />
      </Field>
    </div>
  );
}

function MarqueeForm({ props, onChange, errors }: { props: MarqueeProps; onChange: (p: MarqueeProps) => void; errors: Errors }) {
  return (
    <div className="flex flex-col gap-4">
      {props.items.map((item, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <Text id={`mq-${i}`} label={s.marquee.item(i + 1)} value={item} onChange={(v) => onChange({ ...props, items: props.items.map((x, j) => (j === i ? (v ?? "") : x)) })} error={errors[`items.${i}`]} max={60} required />
          </div>
          {props.items.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ ...props, items: props.items.filter((_, j) => j !== i) })}>
              {s.remove}
            </Button>
          ) : null}
        </div>
      ))}
      {props.items.length < 10 ? (
        <Button variant="outline" onClick={() => onChange({ ...props, items: [...props.items, ""] })}>
          <Plus />
          {s.marquee.add}
        </Button>
      ) : null}
      <Field label={s.marquee.speed}>
        <Segmented value={props.speed} onChange={(v) => onChange({ ...props, speed: v })} options={(["slow", "normal", "fast"] as const).map((k) => ({ value: k, label: s.marquee.speeds[k] }))} />
      </Field>
    </div>
  );
}

function CategoriesForm({ props, onChange, errors }: { props: CategoriesProps; onChange: (p: CategoriesProps) => void; errors: Errors }) {
  const categories = useCategories();
  const set = (patch: Partial<CategoriesProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Heading title={props.title} description={props.description} onChange={set} errors={errors} />
      <Field label={s.categories.pick} hint={s.categories.pickHint} error={errors.category_ids}>
        <MultiSelect value={props.category_ids.map(String)} onChange={(v) => set({ category_ids: v.map(Number) })} options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name, hint: pathOf(categories.data ?? [], c) || undefined }))} placeholder={s.categories.pick} />
      </Field>
      <Field label={s.categories.shape}>
        <Segmented value={props.shape} onChange={(v) => set({ shape: v })} options={(["circle", "square", "card"] as const).map((k) => ({ value: k, label: s.categories.shapes[k] }))} />
      </Field>
      <Field label={s.categories.layout}>
        <Segmented value={props.layout} onChange={(v) => set({ layout: v })} options={(["grid", "slider"] as const).map((k) => ({ value: k, label: s.categories.layouts[k] }))} />
      </Field>
      {props.layout === "grid" ? (
        <>
          <Field label={s.categories.desktop}>
            <Segmented value={String(props.columns_desktop)} onChange={(v) => set({ columns_desktop: Number(v) })} options={[3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: String(n) }))} />
          </Field>
          <Field label={s.categories.mobile}>
            <Segmented value={String(props.columns_mobile)} onChange={(v) => set({ columns_mobile: Number(v) })} options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} />
          </Field>
        </>
      ) : null}
    </div>
  );
}

function TabsForm({ props, onChange, errors }: { props: TabsProps; onChange: (p: TabsProps) => void; errors: Errors }) {
  const categories = useCategories();
  const products = useProductChoices();
  const setTab = (i: number, patch: Partial<TabsProps["tabs"][number]>) => onChange({ ...props, tabs: props.tabs.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  return (
    <div className="flex flex-col gap-4">
      <Heading title={props.title} description={props.description} onChange={(p) => onChange({ ...props, ...p })} errors={errors} />
      {props.tabs.map((tab, i) => (
        <Card
          key={i}
          title={s.tabs.tab(i + 1)}
          removeLabel={s.remove}
          onUp={i > 0 ? () => onChange({ ...props, tabs: move(props.tabs, i, i - 1) }) : undefined}
          onDown={i < props.tabs.length - 1 ? () => onChange({ ...props, tabs: move(props.tabs, i, i + 1) }) : undefined}
          onRemove={props.tabs.length > 1 ? () => onChange({ ...props, tabs: props.tabs.filter((_, j) => j !== i) }) : undefined}
        >
          <Text id={`tab-label-${i}`} label={s.tabs.label} value={tab.label} onChange={(v) => setTab(i, { label: v ?? "" })} error={errors[`tabs.${i}.label`]} max={30} required />
          <Field label={s.tabs.source}>
            <Select value={tab.source} onValueChange={(v) => setTab(i, { source: v as TabsProps["tabs"][number]["source"], category_id: null, product_ids: [] })} options={(["latest", "offers", "category", "manual"] as const).map((k) => ({ value: k, label: s.tabs.sources[k] }))} searchable={false} />
          </Field>
          {tab.source === "category" ? (
            <Field label={s.tabs.category} error={errors[`tabs.${i}.category_id`]} required>
              <Select value={tab.category_id ? String(tab.category_id) : ""} onValueChange={(v) => setTab(i, { category_id: v ? Number(v) : null })} options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name, hint: pathOf(categories.data ?? [], c) || undefined }))} placeholder={s.tabs.category} />
            </Field>
          ) : null}
          {tab.source === "manual" ? (
            <Field label={s.tabs.products} error={errors[`tabs.${i}.product_ids`]} required>
              <MultiSelect value={tab.product_ids.map(String)} onChange={(v) => setTab(i, { product_ids: v.map(Number) })} options={(products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))} placeholder={s.tabs.products} />
            </Field>
          ) : null}
        </Card>
      ))}
      {errors.tabs ? <p className="text-xs text-danger">{errors.tabs}</p> : null}
      {props.tabs.length < 6 ? (
        <Button variant="outline" onClick={() => onChange({ ...props, tabs: [...props.tabs, { label: s.tabs.sources.offers, source: "offers", category_id: null, product_ids: [] }] })}>
          <Plus />
          {s.tabs.add}
        </Button>
      ) : null}
      {tab0Limit(props, onChange)}
    </div>
  );
}

function tab0Limit(props: TabsProps, onChange: (p: TabsProps) => void) {
  return (
    <Field label={s.tabs.limit}>
      <Segmented value={String(props.limit)} onChange={(v) => onChange({ ...props, limit: Number(v) })} options={PRODUCT_LIMITS.map((n) => ({ value: String(n), label: String(n) }))} />
    </Field>
  );
}

function BannersForm({ props, onChange, errors, media, onMedia }: { props: BannersProps; onChange: (p: BannersProps) => void; errors: Errors } & Media) {
  const setItem = (i: number, patch: Partial<BannersProps["items"][number]>) => onChange({ items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-3">{s.banners.hint}</p>
      {props.items.map((item, i) => (
        <Card key={i} title={s.banners.item(i + 1)} removeLabel={s.remove} onUp={i > 0 ? () => onChange({ items: move(props.items, i, i - 1) }) : undefined} onDown={i < props.items.length - 1 ? () => onChange({ items: move(props.items, i, i + 1) }) : undefined} onRemove={() => onChange({ items: props.items.filter((_, j) => j !== i) })}>
          <ImagePick id={item.media_id} onChange={(id) => id && setItem(i, { media_id: id })} media={media} onMedia={onMedia} error={errors[`items.${i}.media_id`]} />
          <Text id={`bn-kicker-${i}`} label={s.kicker} value={item.kicker} onChange={(v) => setItem(i, { kicker: v })} error={errors[`items.${i}.kicker`]} max={40} />
          <Text id={`bn-title-${i}`} label={s.title} value={item.title} onChange={(v) => setItem(i, { title: v })} error={errors[`items.${i}.title`]} max={80} />
          <Text id={`bn-btn-${i}`} label={s.buttonLabel} value={item.button_label} onChange={(v) => setItem(i, { button_label: v })} error={errors[`items.${i}.button_label`]} max={30} />
          <LinkField value={item.link} onChange={(link) => setItem(i, { link })} errors={errors} prefix={`items.${i}.link`} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      <AddImages label={ar.design.banner.add} max={3 - props.items.length} onMedia={onMedia} onPick={(items) => onChange({ items: [...props.items, ...items.map((m) => ({ media_id: m.id, kicker: null, title: null, button_label: null, link: NONE }))].slice(0, 3) })} />
    </div>
  );
}

/** «2026-11-20T18:00» in the merchant's own time ↔ ISO in UTC. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CountdownForm({ props, onChange, errors, media, onMedia }: { props: CountdownProps; onChange: (p: CountdownProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<CountdownProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <ImagePick id={props.media_id} onChange={(id) => set({ media_id: id })} media={media} onMedia={onMedia} error={errors.media_id} optional />
      <Text id="cd-kicker" label={s.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="cd-title" label={s.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} error={errors.title} max={80} required />
      <Text id="cd-text" label={s.text} value={props.text} onChange={(v) => set({ text: v })} error={errors.text} max={200} area />
      <Field label={s.countdown.endsAt} htmlFor="cd-ends" error={errors.ends_at} required>
        <Input id="cd-ends" type="datetime-local" dir="ltr" value={toLocalInput(props.ends_at)} onChange={(e) => e.target.value && set({ ends_at: new Date(e.target.value).toISOString() })} />
      </Field>
      <Field label={s.countdown.onEnd}>
        <Segmented value={props.on_end} onChange={(v) => set({ on_end: v })} options={(["hide", "ended"] as const).map((k) => ({ value: k, label: s.countdown.onEnds[k] }))} />
      </Field>
      <Text id="cd-btn" label={s.buttonLabel} value={props.button_label} onChange={(v) => set({ button_label: v })} error={errors.button_label} max={30} />
      <LinkField value={props.link} onChange={(link) => set({ link })} errors={errors} prefix="link" />
    </div>
  );
}

function FeaturedForm({ props, onChange, errors }: { props: FeaturedProps; onChange: (p: FeaturedProps) => void; errors: Errors }) {
  const products = useProductChoices();
  return (
    <div className="flex flex-col gap-4">
      <Field label={s.featured.product} hint={s.featured.productHint} error={errors.product_id} required>
        <Select value={props.product_id ? String(props.product_id) : ""} onValueChange={(v) => onChange({ ...props, product_id: Number(v) })} options={(products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))} placeholder={s.featured.product} />
      </Field>
      <Text id="fp-kicker" label={s.kicker} value={props.kicker} onChange={(v) => onChange({ ...props, kicker: v })} error={errors.kicker} max={40} />
    </div>
  );
}

function VideoForm({ props, onChange, errors, media, onMedia }: { props: VideoProps; onChange: (p: VideoProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<VideoProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Field label={s.video.url} htmlFor="vd-url" hint={s.video.urlHint} error={errors.url} required>
        <Input id="vd-url" dir="ltr" maxLength={300} placeholder="https://www.youtube.com/watch?v=…" value={props.url} onChange={(e) => set({ url: e.target.value.trim() })} />
      </Field>
      <Text id="vd-title" label={s.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      <Text id="vd-text" label={s.text} value={props.text} onChange={(v) => set({ text: v })} error={errors.text} max={200} />
      <ImagePick id={props.cover_media_id} onChange={(id) => set({ cover_media_id: id })} media={media} onMedia={onMedia} label={s.video.cover} error={errors.cover_media_id} optional />
      <p className="text-xs text-ink-3">{s.video.coverHint}</p>
    </div>
  );
}

function BrandsForm({ props, onChange, errors, media, onMedia }: { props: BrandsProps; onChange: (p: BrandsProps) => void; errors: Errors } & Media) {
  const setItem = (i: number, patch: Partial<BrandsProps["items"][number]>) => onChange({ ...props, items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Heading title={props.title} onChange={(p) => onChange({ ...props, title: p.title ?? null })} errors={errors} />
      {props.items.map((item, i) => (
        <Card key={i} title={item.name || s.brands.item(i + 1)} removeLabel={s.remove} onUp={i > 0 ? () => onChange({ ...props, items: move(props.items, i, i - 1) }) : undefined} onDown={i < props.items.length - 1 ? () => onChange({ ...props, items: move(props.items, i, i + 1) }) : undefined} onRemove={() => onChange({ ...props, items: props.items.filter((_, j) => j !== i) })}>
          <ImagePick id={item.media_id} onChange={(id) => id && setItem(i, { media_id: id })} media={media} onMedia={onMedia} error={errors[`items.${i}.media_id`]} />
          <Text id={`br-name-${i}`} label={s.brands.name} value={item.name} onChange={(v) => setItem(i, { name: v })} error={errors[`items.${i}.name`]} max={40} />
          <LinkField value={item.link} onChange={(link) => setItem(i, { link })} errors={errors} prefix={`items.${i}.link`} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      <AddImages label={s.brands.add} max={16 - props.items.length} onMedia={onMedia} onPick={(items) => onChange({ ...props, items: [...props.items, ...items.map((m) => ({ media_id: m.id, name: null, link: NONE }))].slice(0, 16) })} />
    </div>
  );
}

function StoryForm({ props, onChange, errors, media, onMedia }: { props: StoryProps; onChange: (p: StoryProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<StoryProps>) => onChange({ ...props, ...patch });
  const setStat = (i: number, patch: Partial<StoryProps["stats"][number]>) => set({ stats: props.stats.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <ImagePick id={props.media_id || null} onChange={(id) => id && set({ media_id: id })} media={media} onMedia={onMedia} error={errors.media_id} />
      <ImagePick id={props.media2_id} onChange={(id) => set({ media2_id: id })} media={media} onMedia={onMedia} label={s.story.second} error={errors.media2_id} optional />
      <Text id="st-kicker" label={s.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="st-title" label={s.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} error={errors.title} max={80} required />
      <Text id="st-text" label={s.text} value={props.text} onChange={(v) => set({ text: v })} error={errors.text} max={800} area />
      <Field label={s.story.stats}>
        <div className="flex flex-col gap-2">
          {props.stats.map((stat, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input className="w-24" maxLength={12} value={stat.value} onChange={(e) => setStat(i, { value: e.target.value })} aria-label={s.story.value} placeholder="+40K" />
              <Input className="flex-1" maxLength={30} value={stat.label} onChange={(e) => setStat(i, { label: e.target.value })} aria-label={s.story.label} />
              <Button variant="ghost" size="sm" onClick={() => set({ stats: props.stats.filter((_, j) => j !== i) })}>
                {s.remove}
              </Button>
            </div>
          ))}
          {props.stats.length < 3 ? (
            <Button variant="outline" size="sm" onClick={() => set({ stats: [...props.stats, { value: "", label: "" }] })}>
              <Plus />
              {s.story.addStat}
            </Button>
          ) : null}
        </div>
      </Field>
      <Text id="st-btn" label={s.buttonLabel} value={props.button_label} onChange={(v) => set({ button_label: v })} error={errors.button_label} max={30} />
      <LinkField value={props.link} onChange={(link) => set({ link })} errors={errors} prefix="link" />
    </div>
  );
}

function GalleryForm({ props, onChange, errors, media, onMedia }: { props: GalleryProps; onChange: (p: GalleryProps) => void; errors: Errors } & Media) {
  const setItem = (i: number, patch: Partial<GalleryProps["items"][number]>) => onChange({ ...props, items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Heading title={props.title} description={props.description} onChange={(p) => onChange({ ...props, ...p })} errors={errors} />
      <p className="text-xs text-ink-3">{s.gallery.hint}</p>
      {props.items.map((item, i) => (
        <Card key={i} title={s.gallery.item(i + 1)} removeLabel={s.remove} onUp={i > 0 ? () => onChange({ ...props, items: move(props.items, i, i - 1) }) : undefined} onDown={i < props.items.length - 1 ? () => onChange({ ...props, items: move(props.items, i, i + 1) }) : undefined} onRemove={() => onChange({ ...props, items: props.items.filter((_, j) => j !== i) })}>
          <ImagePick id={item.media_id} onChange={(id) => id && setItem(i, { media_id: id })} media={media} onMedia={onMedia} error={errors[`items.${i}.media_id`]} />
          <Text id={`gl-label-${i}`} label={s.gallery.label} value={item.label} onChange={(v) => setItem(i, { label: v })} error={errors[`items.${i}.label`]} max={60} />
          <LinkField value={item.link} onChange={(link) => setItem(i, { link })} errors={errors} prefix={`items.${i}.link`} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      <AddImages label={s.gallery.add} max={12 - props.items.length} onMedia={onMedia} onPick={(items) => onChange({ ...props, items: [...props.items, ...items.map((m) => ({ media_id: m.id, label: null, link: NONE }))].slice(0, 12) })} />
    </div>
  );
}

function FaqForm({ props, onChange, errors }: { props: FaqProps; onChange: (p: FaqProps) => void; errors: Errors }) {
  const setItem = (i: number, patch: Partial<FaqProps["items"][number]>) => onChange({ ...props, items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="fq-title" label={s.title} value={props.title} onChange={(v) => onChange({ ...props, title: v })} error={errors.title} max={80} />
      <Text id="fq-text" label={s.text} value={props.text} onChange={(v) => onChange({ ...props, text: v })} error={errors.text} max={300} />
      <SwitchRow title={s.faq.whatsapp} description={s.faq.whatsappHint} checked={props.whatsapp_button} onCheckedChange={(v) => onChange({ ...props, whatsapp_button: v })} />
      {props.items.map((item, i) => (
        <Card key={i} title={s.faq.item(i + 1)} removeLabel={s.remove} onUp={i > 0 ? () => onChange({ ...props, items: move(props.items, i, i - 1) }) : undefined} onDown={i < props.items.length - 1 ? () => onChange({ ...props, items: move(props.items, i, i + 1) }) : undefined} onRemove={props.items.length > 1 ? () => onChange({ ...props, items: props.items.filter((_, j) => j !== i) }) : undefined}>
          <Text id={`fq-q-${i}`} label={s.faq.question} value={item.question} onChange={(v) => setItem(i, { question: v ?? "" })} error={errors[`items.${i}.question`]} max={160} required />
          <Text id={`fq-a-${i}`} label={s.faq.answer} value={item.answer} onChange={(v) => setItem(i, { answer: v ?? "" })} error={errors[`items.${i}.answer`]} max={1000} required area />
        </Card>
      ))}
      {props.items.length < 20 ? (
        <Button variant="outline" onClick={() => onChange({ ...props, items: [...props.items, { question: "", answer: "" }] })}>
          <Plus />
          {s.faq.add}
        </Button>
      ) : null}
    </div>
  );
}

function LocationForm({ props, onChange, errors }: { props: LocationProps; onChange: (p: LocationProps) => void; errors: Errors }) {
  const setBranch = (i: number, patch: Partial<LocationProps["branches"][number]>) => onChange({ ...props, branches: props.branches.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Heading title={props.title} description={props.description} onChange={(p) => onChange({ ...props, ...p })} errors={errors} />
      {props.branches.map((b, i) => (
        <Card key={i} title={b.name || s.location.branch(i + 1)} removeLabel={s.remove} onUp={i > 0 ? () => onChange({ ...props, branches: move(props.branches, i, i - 1) }) : undefined} onDown={i < props.branches.length - 1 ? () => onChange({ ...props, branches: move(props.branches, i, i + 1) }) : undefined} onRemove={props.branches.length > 1 ? () => onChange({ ...props, branches: props.branches.filter((_, j) => j !== i) }) : undefined}>
          <Text id={`lc-name-${i}`} label={s.location.name} value={b.name} onChange={(v) => setBranch(i, { name: v ?? "" })} error={errors[`branches.${i}.name`]} max={60} required />
          <Text id={`lc-address-${i}`} label={s.location.address} value={b.address} onChange={(v) => setBranch(i, { address: v ?? "" })} error={errors[`branches.${i}.address`]} max={200} required />
          <Field label={s.location.mapUrl} htmlFor={`lc-map-${i}`} hint={s.location.mapUrlHint} error={errors[`branches.${i}.map_url`]} required>
            <Input id={`lc-map-${i}`} dir="ltr" maxLength={500} placeholder="https://maps.app.goo.gl/…" value={b.map_url} onChange={(e) => setBranch(i, { map_url: e.target.value.trim() })} />
          </Field>
          <Text id={`lc-hours-${i}`} label={s.location.hours} value={b.hours} onChange={(v) => setBranch(i, { hours: v })} error={errors[`branches.${i}.hours`]} max={60} />
          <Text id={`lc-phone-${i}`} label={s.location.phone} value={b.phone} onChange={(v) => setBranch(i, { phone: v })} error={errors[`branches.${i}.phone`]} max={30} />
        </Card>
      ))}
      {props.branches.length < 6 ? (
        <Button variant="outline" onClick={() => onChange({ ...props, branches: [...props.branches, { name: "", address: "", hours: null, phone: null, map_url: "" }] })}>
          <Plus />
          {s.location.add}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The forms of the section library types (StoreSections on the back end): any store theme that
 * offers one of these types uses its form. «أساس»'s four types have theirs in section-forms.tsx.
 */
export function LibrarySectionForm({ section, errors, onChange, media, onMedia }: { section: SufiSection; errors: Errors; onChange: (props: SufiSection["props"]) => void } & Media) {
  const m = { media, onMedia };
  switch (section.type) {
    case "hero":
      return <HeroForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "marquee":
      return <MarqueeForm props={section.props} onChange={onChange} errors={errors} />;
    case "categories":
      return <CategoriesForm props={section.props} onChange={onChange} errors={errors} />;
    case "product_tabs":
      return <TabsForm props={section.props} onChange={onChange} errors={errors} />;
    case "banners":
      return <BannersForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "countdown":
      return <CountdownForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "featured_product":
      return <FeaturedForm props={section.props} onChange={onChange} errors={errors} />;
    case "video":
      return <VideoForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "brands":
      return <BrandsForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "story":
      return <StoryForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "gallery":
      return <GalleryForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "faq":
      return <FaqForm props={section.props} onChange={onChange} errors={errors} />;
    case "location":
      return <LocationForm props={section.props} onChange={onChange} errors={errors} />;
    default:
      return null;
  }
}

