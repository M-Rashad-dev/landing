"use client";

import { Plus, Star, X, type LucideIcon } from "lucide-react";
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

/*
 * The pieces of the landing themes' own Builder forms («شابع», «صوفي»…): texts, pictures, icons,
 * lists, dates, and the forms of the sections several themes share (offer cards, reviews).
 */

const t = ar.landings.builder.forms;
const tt = ar.design.testimonials;
export type Errors = Record<string, string>;
export type Media = { media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void };
export type IconItem<K extends string> = { icon: K; title: string; text: string | null };

export type BundleCard = { offer_id: number | null; image_media_id: number | null; title: string; subtitle: string | null; points: string[]; ribbon: string | null };
export type BundlesProps = { kicker: string | null; title: string | null; subtitle: string | null; cards: BundleCard[] };
export type TestimonialsProps = {
  kicker: string | null;
  title: string | null;
  source: "auto" | "manual";
  items: Array<{ name: string; place: string | null; rating: number; text: string; image_media_id: number | null }>;
  show_score: boolean;
};

export const imageOf = (media: Record<string, MediaUrls>, id: number | null) => {
  const url = id ? pick(media[String(id)], "thumb") : null;
  return id && url ? { id, url } : null;
};

/** «2026-11-20T18:00» in the merchant's own time ↔ ISO in UTC. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTime({ id, value, onChange }: { id: string; value: string | null; onChange: (iso: string | null) => void }) {
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

export function Text({ id, label, value, onChange, max, error, required = false, hint, area = false }: { id: string; label: string; value: string | null; onChange: (v: string | null) => void; max: number; error?: string; required?: boolean; hint?: string; area?: boolean }) {
  const set = (v: string) => onChange(required ? v : nullable(v));
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required} optional={!required}>
      {area ? <Textarea id={id} rows={2} maxLength={max} value={value ?? ""} onChange={(e) => set(e.target.value)} /> : <Input id={id} maxLength={max} value={value ?? ""} onChange={(e) => set(e.target.value)} />}
    </Field>
  );
}

export function ImagePick({ label, hint, id, onChange, media, onMedia, error }: { label: string; hint?: string; id: number | null; onChange: (id: number | null) => void; error?: string } & Media) {
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

/** The icons a theme offers, picked by key. */
export function IconPicker<K extends string>({ value, onChange, icons }: { value: K; onChange: (v: K) => void; icons: Record<K, LucideIcon> }) {
  return (
    <Field label={t.icon}>
      <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label={t.icon}>
        {(Object.keys(icons) as K[]).map((key) => {
          const Icon: LucideIcon = icons[key];
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
export function TextList({ id, label, hint, values, onChange, max, length, min = 0, error, errors }: { id: string; label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; max: number; length: number; min?: number; error?: string; errors: Errors }) {
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
export function under(errors: Errors, key: string): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(errors)) if (k.startsWith(`${key}.`)) out[k.slice(key.length + 1)] = v;
  return out;
}

/** Icon + title + text items (why us, steps). */
export function IconItems<K extends string>({ items, onChange, errors, min, max, label, icons, fallback, length = 160 }: { items: Array<IconItem<K>>; onChange: (items: Array<IconItem<K>>) => void; errors: Errors; min: number; max: number; label: (n: number) => string; icons: Record<K, LucideIcon>; fallback: K; length?: number }) {
  const set = (i: number, patch: Partial<IconItem<K>>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
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
          <IconPicker value={item.icon} onChange={(icon) => set(i, { icon })} icons={icons} />
          <Text id={`ii-title-${i}`} label={t.title} value={item.title} onChange={(v) => set(i, { title: v ?? "" })} max={40} required error={errors[`items.${i}.title`]} />
          <Text id={`ii-text-${i}`} label={t.text} value={item.text} onChange={(v) => set(i, { text: v })} max={length} error={errors[`items.${i}.text`]} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      {items.length < max ? (
        <Button variant="outline" onClick={() => onChange([...items, { icon: fallback, title: ar.design.builder.defaults.featureTitle, text: null }])}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
    </>
  );
}

/** Offer cards tied to the product's offers (any theme whose cards have this shape). */
export function BundlesForm({ props, onChange, errors, media, onMedia, offers }: { props: BundlesProps; onChange: (p: BundlesProps) => void; errors: Errors; offers: ProductOffer[] } & Media) {
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

/** Reviews: the product's own or written by the merchant, with a place and a picture. */
export function TestimonialsForm({ props, onChange, errors, media, onMedia }: { props: TestimonialsProps; onChange: (p: TestimonialsProps) => void; errors: Errors } & Media) {
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

