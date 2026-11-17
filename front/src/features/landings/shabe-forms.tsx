"use client";

import { Plus, Star, X } from "lucide-react";
import * as React from "react";
import { ColorInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { RadioCards, SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, move, nullable } from "@/features/builder/section-forms";
import { ImageField } from "@/features/media/image-fields";
import type { MediaItem } from "@/features/media/api";
import { activeOffers } from "@/lib/store/offers";
import type { ProductOffer } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, type MediaUrls } from "@/themes/shared/design";
import { SHABE_ICON_KEYS, SHABE_ICONS } from "@/themes/landing/shabe/icons";
import type {
  BundleCard,
  BundlesProps,
  CompareProps,
  GuaranteeProps,
  HeroProps,
  MarqueeProps,
  MenuProps,
  OrderFormProps,
  ShabeIcon,
  ShabeSection,
  ShabeSectionType,
  ShabeSettings,
  StepsProps,
  TestimonialsProps,
  UrgencyProps,
  VideoProps,
  WhyProps,
} from "@/themes/landing/shabe/types";
import { newId } from "./builder-api";
import { FaqForm, GalleryForm, OrderFormForm } from "./builder-forms";

const t = ar.landings.builder.shabe;
const tt = ar.design.testimonials;
type Errors = Record<string, string>;
type Media = { media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void };

const imageOf = (media: Record<string, MediaUrls>, id: number | null) => {
  const url = id ? pick(media[String(id)], "thumb") : null;
  return id && url ? { id, url } : null;
};

/** Sections a merchant can add to a «شابع» page (the order form is always there, once). */
export const SHABE_ADDABLE: Exclude<ShabeSectionType, "order_form">[] = ["hero", "marquee", "menu", "why", "steps", "bundles", "gallery", "video", "compare", "testimonials", "urgency", "guarantee", "faq"];

/** «2026-11-20T18:00» in the merchant's own time ↔ ISO in UTC. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DateTime({ id, value, onChange }: { id: string; value: string | null; onChange: (iso: string | null) => void }) {
  return (
    <div className="flex gap-2">
      <Input id={id} type="datetime-local" dir="ltr" value={toLocalInput(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />
      {value ? (
        <Button variant="ghost" size="icon" aria-label={t.clear} onClick={() => onChange(null)}>
          <X />
        </Button>
      ) : null}
    </div>
  );
}

function Text({ id, label, value, onChange, max, error, required = false, hint, area = false }: { id: string; label: string; value: string | null; onChange: (v: string | null) => void; max: number; error?: string; required?: boolean; hint?: string; area?: boolean }) {
  const set = (v: string) => onChange(required ? v : nullable(v));
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required} optional={!required}>
      {area ? <Textarea id={id} rows={2} maxLength={max} value={value ?? ""} onChange={(e) => set(e.target.value)} /> : <Input id={id} maxLength={max} value={value ?? ""} onChange={(e) => set(e.target.value)} />}
    </Field>
  );
}

function ImagePick({ label, hint, id, onChange, media, onMedia, error }: { label: string; hint?: string; id: number | null; onChange: (id: number | null) => void; error?: string } & Media) {
  return (
    <Field label={label} hint={hint} error={error}>
      <ImageField
        value={imageOf(media, id)}
        onChange={(item) => {
          if (item) onMedia(item);
          onChange(item?.id ?? null);
        }}
      />
    </Field>
  );
}

function IconPicker({ value, onChange }: { value: ShabeIcon; onChange: (v: ShabeIcon) => void }) {
  return (
    <Field label={t.icon}>
      <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label={t.icon}>
        {SHABE_ICON_KEYS.map((key) => {
          const Icon = SHABE_ICONS[key];
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value === key}
              aria-label={key}
              onClick={() => onChange(key)}
              className={cn("flex size-8 items-center justify-center rounded-md border", value === key ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-ink-2 hover:bg-surface-2")}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </Field>
  );
}

/** A list of short texts (marquee words, extras, card points…). */
function TextList({ id, label, hint, values, onChange, max, length, min = 0, error, errors }: { id: string; label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; max: number; length: number; min?: number; error?: string; errors: Errors }) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex flex-col gap-2">
        {values.map((value, i) => (
          <div key={i}>
            <div className="flex gap-1.5">
              <Input id={`${id}-${i}`} aria-label={`${label} ${i + 1}`} maxLength={length} value={value} onChange={(e) => onChange(values.map((v, j) => (j === i ? e.target.value : v)))} />
              {values.length > min ? (
                <Button size="icon" variant="ghost" aria-label={t.remove} onClick={() => onChange(values.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              ) : null}
            </div>
            {errors[`${i}`] ? <p className="mt-1 text-xs text-danger">{errors[`${i}`]}</p> : null}
          </div>
        ))}
        {values.length < max ? (
          <Button variant="outline" size="sm" className="w-fit" onClick={() => onChange([...values, ""])}>
            <Plus />
            {t.add}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

/** Errors under a list key ("items.2.title" → for TextList: "2"). */
function under(errors: Errors, key: string): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(errors)) if (k.startsWith(`${key}.`)) out[k.slice(key.length + 1)] = v;
  return out;
}

/** Icon + title + text items (why us, steps). */
function IconItems({ items, onChange, errors, min, max, label }: { items: WhyProps["items"]; onChange: (items: WhyProps["items"]) => void; errors: Errors; min: number; max: number; label: (n: number) => string }) {
  const set = (i: number, patch: Partial<WhyProps["items"][number]>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <>
      {items.map((item, i) => (
        <Card
          key={i}
          title={label(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => onChange(move(items, i, i - 1)) : undefined}
          onDown={i < items.length - 1 ? () => onChange(move(items, i, i + 1)) : undefined}
          onRemove={items.length > min ? () => onChange(items.filter((_, j) => j !== i)) : undefined}
        >
          <IconPicker value={item.icon} onChange={(icon) => set(i, { icon })} />
          <Text id={`ii-title-${i}`} label={t.title} value={item.title} onChange={(v) => set(i, { title: v ?? "" })} max={40} required error={errors[`items.${i}.title`]} />
          <Text id={`ii-text-${i}`} label={t.text} value={item.text} onChange={(v) => set(i, { text: v })} max={160} error={errors[`items.${i}.text`]} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      {items.length < max ? (
        <Button variant="outline" onClick={() => onChange([...items, { icon: "star", title: ar.design.builder.defaults.featureTitle, text: null }])}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
    </>
  );
}

/* ---------- sections ---------- */

function HeroForm({ props, onChange, errors, media, onMedia }: { props: HeroProps; onChange: (p: HeroProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<HeroProps>) => onChange({ ...props, ...patch });
  const h = ar.landings.builder.hero;
  return (
    <div className="flex flex-col gap-4">
      <Text id="sh-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="sh-title" label={t.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} max={120} required area error={errors.title} />
      <Text id="sh-highlight" label={t.highlight} hint={t.highlightHint} value={props.highlight} onChange={(highlight) => set({ highlight })} max={60} error={errors.highlight} />
      <Text id="sh-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={300} area error={errors.subtitle} />
      <ImagePick label={h.image} hint={h.imageHint} id={props.image_media_id} onChange={(image_media_id) => set({ image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
      <TextList id="sh-stickers" label={t.stickers} values={props.stickers} onChange={(stickers) => set({ stickers })} max={2} length={30} error={errors.stickers} errors={under(errors, "stickers")} />
      <Text id="sh-badge" label={t.badge} hint={t.badgeHint} value={props.badge} onChange={(badge) => set({ badge })} max={24} error={errors.badge} />
      <SwitchRow title={h.showPrice} checked={props.show_price} onCheckedChange={(show_price) => set({ show_price })} />
      <SwitchRow title={t.showRating} checked={props.show_rating} onCheckedChange={(show_rating) => set({ show_rating })} />
      <Text id="sh-button" label={h.button} value={props.button_label} onChange={(v) => set({ button_label: v ?? "" })} max={40} required error={errors.button_label} />
      <Text id="sh-second" label={t.second} hint={t.secondHint} value={props.second_label} onChange={(second_label) => set({ second_label })} max={40} error={errors.second_label} />
      <p className="text-sm font-semibold">{t.trust}</p>
      {props.trust.map((item, i) => (
        <Card key={i} title={t.trustItem(i + 1)} removeLabel={t.remove} onRemove={() => set({ trust: props.trust.filter((_, j) => j !== i) })}>
          <IconPicker value={item.icon} onChange={(icon) => set({ trust: props.trust.map((x, j) => (j === i ? { ...x, icon } : x)) })} />
          <Text id={`sh-trust-${i}`} label={t.text} value={item.text} onChange={(v) => set({ trust: props.trust.map((x, j) => (j === i ? { ...x, text: v ?? "" } : x)) })} max={40} required error={errors[`trust.${i}.text`]} />
        </Card>
      ))}
      {props.trust.length < 3 ? (
        <Button variant="outline" onClick={() => set({ trust: [...props.trust, { icon: "truck", text: "" }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
    </div>
  );
}

function MarqueeForm({ props, onChange, errors }: { props: MarqueeProps; onChange: (p: MarqueeProps) => void; errors: Errors }) {
  return <TextList id="sh-mq" label={t.items} values={props.items} onChange={(items) => onChange({ items })} max={10} min={1} length={40} error={errors.items} errors={under(errors, "items")} />;
}

function MenuForm({ props, onChange, errors, media, onMedia }: { props: MenuProps; onChange: (p: MenuProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<MenuProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<MenuProps["items"][number]>) => set({ items: props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="mn-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="mn-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="mn-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={200} error={errors.subtitle} />
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={t.dish(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 1 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
        >
          <ImagePick label={t.image} hint={t.imageHint} id={item.image_media_id} onChange={(image_media_id) => setItem(i, { image_media_id })} media={media} onMedia={onMedia} error={errors[`items.${i}.image_media_id`]} />
          <Text id={`mn-t-${i}`} label={t.dishTitle} value={item.title} onChange={(v) => setItem(i, { title: v ?? "" })} max={40} required error={errors[`items.${i}.title`]} />
          <Text id={`mn-d-${i}`} label={t.dishText} value={item.text} onChange={(text) => setItem(i, { text })} max={120} error={errors[`items.${i}.text`]} />
          <Text id={`mn-g-${i}`} label={t.tag} hint={t.tagHint} value={item.tag} onChange={(tag) => setItem(i, { tag })} max={24} error={errors[`items.${i}.tag`]} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      {props.items.length < 8 ? (
        <Button variant="outline" onClick={() => set({ items: [...props.items, { image_media_id: null, title: "", text: null, tag: null }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
      <TextList id="mn-x" label={t.extras} hint={t.extrasHint} values={props.extras} onChange={(extras) => set({ extras })} max={12} length={40} error={errors.extras} errors={under(errors, "extras")} />
    </div>
  );
}

function WhyForm({ props, onChange, errors, media, onMedia }: { props: WhyProps; onChange: (p: WhyProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<WhyProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="wy-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="wy-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="wy-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={200} error={errors.subtitle} />
      <ImagePick label={t.image} hint={t.imageHint} id={props.image_media_id} onChange={(image_media_id) => set({ image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
      <Text id="wy-quote" label={t.quote} value={props.quote} onChange={(quote) => set({ quote })} max={160} area error={errors.quote} />
      <IconItems items={props.items} onChange={(items) => set({ items })} errors={errors} min={2} max={6} label={t.feature} />
    </div>
  );
}

function StepsForm({ props, onChange, errors }: { props: StepsProps; onChange: (p: StepsProps) => void; errors: Errors }) {
  const set = (patch: Partial<StepsProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="st-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="st-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <IconItems items={props.items} onChange={(items) => set({ items })} errors={errors} min={2} max={4} label={t.step} />
    </div>
  );
}

function BundlesForm({ props, onChange, errors, media, onMedia, offers }: { props: BundlesProps; onChange: (p: BundlesProps) => void; errors: Errors; offers: ProductOffer[] } & Media) {
  const set = (patch: Partial<BundlesProps>) => onChange({ ...props, ...patch });
  const setCard = (i: number, patch: Partial<BundleCard>) => set({ cards: props.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const choices = [{ value: "0", label: t.onePiece }, ...activeOffers(offers).map((o) => ({ value: String(o.id), label: o.name }))];
  return (
    <div className="flex flex-col gap-4">
      <Text id="bn-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="bn-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="bn-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={200} error={errors.subtitle} />
      <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">{t.cardsHint}</p>
      {props.cards.map((card, i) => (
        <Card
          key={i}
          title={t.card(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ cards: move(props.cards, i, i - 1) }) : undefined}
          onDown={i < props.cards.length - 1 ? () => set({ cards: move(props.cards, i, i + 1) }) : undefined}
          onRemove={() => set({ cards: props.cards.filter((_, j) => j !== i) })}
        >
          <Field label={t.cardOffer} hint={t.cardOfferHint} htmlFor={`bn-o-${i}`} error={errors[`cards.${i}.offer_id`]}>
            <Select id={`bn-o-${i}`} value={String(card.offer_id ?? 0)} onValueChange={(v) => setCard(i, { offer_id: v === "0" ? null : Number(v) })} options={choices} searchable={false} />
          </Field>
          <ImagePick label={t.image} hint={t.imageHint} id={card.image_media_id} onChange={(image_media_id) => setCard(i, { image_media_id })} media={media} onMedia={onMedia} error={errors[`cards.${i}.image_media_id`]} />
          <Text id={`bn-t-${i}`} label={t.cardTitle} value={card.title} onChange={(v) => setCard(i, { title: v ?? "" })} max={40} required error={errors[`cards.${i}.title`]} />
          <Text id={`bn-s-${i}`} label={t.cardSubtitle} hint={t.cardSubtitleHint} value={card.subtitle} onChange={(subtitle) => setCard(i, { subtitle })} max={60} error={errors[`cards.${i}.subtitle`]} />
          <TextList id={`bn-p-${i}`} label={t.points} values={card.points} onChange={(points) => setCard(i, { points })} max={5} length={60} error={errors[`cards.${i}.points`]} errors={under(errors, `cards.${i}.points`)} />
          <Text id={`bn-r-${i}`} label={t.ribbon} hint={t.ribbonHint} value={card.ribbon} onChange={(ribbon) => setCard(i, { ribbon })} max={24} error={errors[`cards.${i}.ribbon`]} />
        </Card>
      ))}
      {props.cards.length < 4 ? (
        <Button variant="outline" onClick={() => set({ cards: [...props.cards, { offer_id: null, image_media_id: null, title: t.onePiece, subtitle: null, points: [], ribbon: null }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
    </div>
  );
}

function VideoForm({ props, onChange, errors, media, onMedia }: { props: VideoProps; onChange: (p: VideoProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<VideoProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="vd-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="vd-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={200} error={errors.subtitle} />
      <Field label={t.videoUrl} hint={t.videoUrlHint} htmlFor="vd-url" error={errors.url} required>
        <Input id="vd-url" dir="ltr" maxLength={300} value={props.url} onChange={(e) => set({ url: e.target.value })} />
      </Field>
      <ImagePick label={t.cover} hint={t.coverHint} id={props.cover_media_id} onChange={(cover_media_id) => set({ cover_media_id })} media={media} onMedia={onMedia} error={errors.cover_media_id} />
      <Text id="vd-caption" label={t.caption} value={props.caption} onChange={(caption) => set({ caption })} max={60} error={errors.caption} />
    </div>
  );
}

function CompareForm({ props, onChange, errors }: { props: CompareProps; onChange: (p: CompareProps) => void; errors: Errors }) {
  const set = (patch: Partial<CompareProps>) => onChange({ ...props, ...patch });
  const setRow = (i: number, patch: Partial<CompareProps["rows"][number]>) => set({ rows: props.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="cp-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <div className="grid grid-cols-2 gap-3">
        <Text id="cp-us" label={t.us} value={props.us} onChange={(v) => set({ us: v ?? "" })} max={30} required error={errors.us} />
        <Text id="cp-them" label={t.them} value={props.them} onChange={(v) => set({ them: v ?? "" })} max={30} required error={errors.them} />
      </div>
      {props.rows.map((row, i) => (
        <Card
          key={i}
          title={t.row(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ rows: move(props.rows, i, i - 1) }) : undefined}
          onDown={i < props.rows.length - 1 ? () => set({ rows: move(props.rows, i, i + 1) }) : undefined}
          onRemove={props.rows.length > 2 ? () => set({ rows: props.rows.filter((_, j) => j !== i) }) : undefined}
        >
          <Text id={`cp-l-${i}`} label={t.rowLabel} value={row.label} onChange={(v) => setRow(i, { label: v ?? "" })} max={50} required error={errors[`rows.${i}.label`]} />
          <div className="grid grid-cols-2 gap-3">
            <Text id={`cp-u-${i}`} label={t.rowUs} value={row.us} onChange={(v) => setRow(i, { us: v ?? "" })} max={50} required error={errors[`rows.${i}.us`]} />
            <Text id={`cp-t-${i}`} label={t.rowThem} value={row.them} onChange={(v) => setRow(i, { them: v ?? "" })} max={50} required error={errors[`rows.${i}.them`]} />
          </div>
        </Card>
      ))}
      {errors.rows ? <p className="text-xs text-danger">{errors.rows}</p> : null}
      {props.rows.length < 8 ? (
        <Button variant="outline" onClick={() => set({ rows: [...props.rows, { label: "", us: "✓", them: "✗" }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
    </div>
  );
}

function TestimonialsForm({ props, onChange, errors, media, onMedia }: { props: TestimonialsProps; onChange: (p: TestimonialsProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<TestimonialsProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<TestimonialsProps["items"][number]>) => set({ items: props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const blank = { name: "", place: null, rating: 5, text: "", image_media_id: null };
  return (
    <div className="flex flex-col gap-4">
      <Text id="rv-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="rv-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <SwitchRow title={t.showScore} checked={props.show_score} onCheckedChange={(show_score) => set({ show_score })} />
      <Field label={tt.source}>
        <RadioCards
          className="sm:grid-cols-1"
          value={props.source}
          onValueChange={(v) => set({ source: v as TestimonialsProps["source"], items: v === "manual" && props.items.length === 0 ? [blank] : props.items })}
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
              onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
              onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
              onRemove={props.items.length > 1 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
            >
              <Text id={`rv-n-${i}`} label={tt.name} value={item.name} onChange={(v) => setItem(i, { name: v ?? "" })} max={60} required error={errors[`items.${i}.name`]} />
              <Text id={`rv-p-${i}`} label={t.place} value={item.place} onChange={(place) => setItem(i, { place })} max={40} error={errors[`items.${i}.place`]} />
              <Field label={tt.rating}>
                <div className="flex gap-1" role="radiogroup" aria-label={tt.rating}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={item.rating === n} aria-label={tt.stars(n)} onClick={() => setItem(i, { rating: n })} className="p-0.5">
                      <Star className={cn("size-5", n <= item.rating ? "fill-accent text-accent" : "text-ink-3")} />
                    </button>
                  ))}
                </div>
              </Field>
              <Text id={`rv-t-${i}`} label={tt.text} value={item.text} onChange={(v) => setItem(i, { text: v ?? "" })} max={400} required area error={errors[`items.${i}.text`]} />
              <ImagePick label={t.image} id={item.image_media_id} onChange={(image_media_id) => setItem(i, { image_media_id })} media={media} onMedia={onMedia} error={errors[`items.${i}.image_media_id`]} />
            </Card>
          ))}
          {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
          {props.items.length < 12 ? (
            <Button variant="outline" onClick={() => set({ items: [...props.items, blank] })}>
              <Plus />
              {tt.add}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function UrgencyForm({ props, onChange, errors }: { props: UrgencyProps; onChange: (p: UrgencyProps) => void; errors: Errors }) {
  const set = (patch: Partial<UrgencyProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="ur-title" label={t.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} max={80} required error={errors.title} />
      <Text id="ur-text" label={t.subtitle} value={props.text} onChange={(text) => set({ text })} max={160} error={errors.text} />
      <Field label={t.endsAt} hint={t.endsAtHint} htmlFor="ur-ends" error={errors.ends_at} optional>
        <DateTime id="ur-ends" value={props.ends_at} onChange={(ends_at) => set({ ends_at })} />
      </Field>
      <SwitchRow title={t.showStock} description={t.showStockHint} checked={props.show_stock} onCheckedChange={(show_stock) => set({ show_stock })} />
    </div>
  );
}

function ShabeOrderForm({ props, onChange, errors, media, onMedia }: { props: OrderFormProps; onChange: (p: OrderFormProps) => void; errors: Errors } & Media) {
  return (
    <div className="flex flex-col gap-4">
      <Text id="of-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => onChange({ ...props, kicker })} max={60} error={errors.kicker} />
      <OrderFormForm props={props} onChange={(p) => onChange({ ...props, ...p })} errors={errors} />
      <TextList id="of-points" label={t.formPoints} values={props.points} onChange={(points) => onChange({ ...props, points })} max={5} length={60} error={errors.points} errors={under(errors, "points")} />
      <ImagePick label={t.formImage} hint={t.imageHint} id={props.image_media_id} onChange={(image_media_id) => onChange({ ...props, image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
    </div>
  );
}

function GuaranteeForm({ props, onChange, errors }: { props: GuaranteeProps; onChange: (p: GuaranteeProps) => void; errors: Errors }) {
  return (
    <div className="flex flex-col gap-4">
      <IconPicker value={props.icon} onChange={(icon) => onChange({ ...props, icon })} />
      <Text id="gu-title" label={t.title} value={props.title} onChange={(v) => onChange({ ...props, title: v ?? "" })} max={80} required error={errors.title} />
      <Text id="gu-text" label={t.text} value={props.text} onChange={(text) => onChange({ ...props, text })} max={300} area error={errors.text} />
    </div>
  );
}

export function ShabeSectionForm({ section, errors, onChange, media, onMedia, offers }: { section: ShabeSection; errors: Errors; onChange: (props: ShabeSection["props"]) => void; offers: ProductOffer[] } & Media) {
  const m = { media, onMedia };
  switch (section.type) {
    case "hero":
      return <HeroForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "marquee":
      return <MarqueeForm props={section.props} onChange={onChange} errors={errors} />;
    case "menu":
      return <MenuForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "why":
      return <WhyForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "steps":
      return <StepsForm props={section.props} onChange={onChange} errors={errors} />;
    case "bundles":
      return <BundlesForm props={section.props} onChange={onChange} errors={errors} offers={offers} {...m} />;
    case "gallery":
      return <GalleryForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "video":
      return <VideoForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "compare":
      return <CompareForm props={section.props} onChange={onChange} errors={errors} />;
    case "testimonials":
      return <TestimonialsForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "urgency":
      return <UrgencyForm props={section.props} onChange={onChange} errors={errors} />;
    case "order_form":
      return <ShabeOrderForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "guarantee":
      return <GuaranteeForm props={section.props} onChange={onChange} errors={errors} />;
    case "faq":
      return <FaqForm props={section.props} onChange={onChange} errors={errors} />;
  }
}

/* ---------- theme settings (beside «بداية»'s own forms) ---------- */

type SettingsProps = { settings: ShabeSettings; onChange: (s: ShabeSettings) => void; errors: Errors };

export function ShabeLookExtras({ settings, onChange, errors }: SettingsProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={t.dark} error={errors["colors.dark"]}>
        <ColorInput value={settings.colors.dark} onChange={(v) => onChange({ ...settings, colors: { ...settings.colors, dark: v.toLowerCase() } })} />
      </Field>
      <SwitchRow title={t.displayFont} description={t.displayFontHint} checked={settings.display_font} onCheckedChange={(display_font) => onChange({ ...settings, display_font })} />
    </div>
  );
}

export function ShabeHeaderExtras({ settings, onChange, errors }: SettingsProps) {
  const set = (patch: Partial<ShabeSettings["header"]>) => onChange({ ...settings, header: { ...settings.header, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <Field label={t.countdown} hint={t.countdownHint} htmlFor="sh-cd" error={errors["header.countdown_ends_at"]} optional>
        <DateTime id="sh-cd" value={settings.header.countdown_ends_at} onChange={(countdown_ends_at) => set({ countdown_ends_at })} />
      </Field>
      <Field label={t.headerPhone} htmlFor="sh-hp" error={errors["header.phone"]} optional>
        <Input id="sh-hp" dir="ltr" maxLength={30} value={settings.header.phone ?? ""} onChange={(e) => set({ phone: nullable(e.target.value) })} />
      </Field>
      <Text id="sh-hb" label={t.headerButton} hint={t.headerButtonHint} value={settings.header.button_label} onChange={(button_label) => set({ button_label })} max={40} error={errors["header.button_label"]} />
    </div>
  );
}

/* ---------- a new section, ready to edit ---------- */

export function newShabeSection(type: Exclude<ShabeSectionType, "order_form">, productName: string | null): ShabeSection {
  const id = newId();
  const types = ar.landings.builder.types;
  const title = types[type].title;
  const icon = (title: string): WhyProps["items"][number] => ({ icon: "star", title, text: null });
  switch (type) {
    case "hero":
      return { id, type, visible: true, props: { kicker: null, title: productName ?? title, highlight: null, subtitle: null, image_media_id: null, stickers: [], badge: null, show_price: true, show_rating: true, button_label: ar.bidaya.orderNow, second_label: null, trust: [] } };
    case "marquee":
      return { id, type, visible: true, props: { items: [title] } };
    case "menu":
      return { id, type, visible: true, props: { kicker: null, title, subtitle: null, items: [{ image_media_id: null, title: t.dish(1), text: null, tag: null }], extras: [] } };
    case "why":
      return { id, type, visible: true, props: { kicker: null, title, subtitle: null, image_media_id: null, quote: null, items: [icon(t.feature(1)), icon(t.feature(2))] } };
    case "steps":
      return { id, type, visible: true, props: { kicker: null, title, items: [icon(t.step(1)), icon(t.step(2)), icon(t.step(3))] } };
    case "bundles":
      return { id, type, visible: true, props: { kicker: null, title, subtitle: null, cards: [] } };
    case "gallery":
      return { id, type, visible: true, props: { title, image_media_ids: [] } };
    case "video":
      return { id, type, visible: true, props: { title, subtitle: null, url: "", cover_media_id: null, caption: null } };
    case "compare":
      return { id, type, visible: true, props: { title, us: t.rowUs, them: t.rowThem, rows: [{ label: t.row(1), us: "✓", them: "✗" }, { label: t.row(2), us: "✓", them: "✗" }] } };
    case "testimonials":
      return { id, type, visible: true, props: { kicker: null, title, source: "auto", items: [], show_score: true } };
    case "urgency":
      return { id, type, visible: true, props: { title, text: null, ends_at: new Date(Date.now() + 2 * 86400000).toISOString(), show_stock: false } };
    case "guarantee":
      return { id, type, visible: true, props: { icon: "shield", title, text: null } };
    case "faq":
      return { id, type, visible: true, props: { title, items: [{ question: ar.landings.builder.faq.question, answer: ar.landings.builder.faq.answer }] } };
  }
}
