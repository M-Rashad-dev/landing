"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from "lucide-react";
import * as React from "react";
import { ColorInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Checkbox, SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { ImageField } from "@/features/media/image-fields";
import { MediaPicker } from "@/features/media/media-picker";
import type { MediaItem } from "@/features/media/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SocialIcon } from "@/themes/asas/icons";
import { FONTS, PALETTES, pick, SOCIALS, type Colors, type FontKey, type FontSize, type MediaUrls } from "@/themes/asas/types";
import { SWITCHABLE, type ButtonShape, type FaqProps, type GalleryProps, type HeroProps, type OrderFormProps, type Settings } from "@/themes/bidaya/types";

const t = ar.landings.builder;
const th = ar.design.theme;
type Errors = Record<string, string>;
const nullable = (v: string) => (v.trim() === "" ? null : v);

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const imageOf = (media: Record<string, MediaUrls>, id: number | null) => {
  const url = id ? pick(media[String(id)], "thumb") : null;
  return id && url ? { id, url } : null;
};

/* ---------- sections ---------- */

export function HeroForm({ props, onChange, errors, media, onMedia }: { props: HeroProps; onChange: (p: HeroProps) => void; errors: Errors; media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void }) {
  const h = t.hero;
  return (
    <div className="flex flex-col gap-4">
      <Field label={h.title} htmlFor="hero-title" error={errors.title} required>
        <Textarea id="hero-title" rows={2} maxLength={120} value={props.title} onChange={(e) => onChange({ ...props, title: e.target.value })} />
      </Field>
      <Field label={h.subtitle} htmlFor="hero-subtitle" error={errors.subtitle} optional>
        <Textarea id="hero-subtitle" rows={2} maxLength={300} value={props.subtitle ?? ""} onChange={(e) => onChange({ ...props, subtitle: nullable(e.target.value) })} />
      </Field>
      <Field label={h.image} hint={h.imageHint} error={errors.image_media_id}>
        <ImageField
          value={imageOf(media, props.image_media_id)}
          onChange={(item) => {
            if (item) onMedia(item);
            onChange({ ...props, image_media_id: item?.id ?? null });
          }}
        />
      </Field>
      <Field label={h.badge} htmlFor="hero-badge" hint={h.badgeHint} error={errors.badge} optional>
        <Input id="hero-badge" maxLength={40} value={props.badge ?? ""} onChange={(e) => onChange({ ...props, badge: nullable(e.target.value) })} />
      </Field>
      <SwitchRow title={h.showPrice} checked={props.show_price} onCheckedChange={(v) => onChange({ ...props, show_price: v })} />
      <Field label={h.button} htmlFor="hero-button" error={errors.button_label} required>
        <Input id="hero-button" maxLength={40} value={props.button_label} onChange={(e) => onChange({ ...props, button_label: e.target.value })} />
      </Field>
    </div>
  );
}

export function GalleryForm({ props, onChange, errors, media, onMedia }: { props: GalleryProps; onChange: (p: GalleryProps) => void; errors: Errors; media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void }) {
  const g = t.gallery;
  const [picking, setPicking] = React.useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Field label={g.title} htmlFor="gal-title" error={errors.title} optional>
        <Input id="gal-title" maxLength={80} value={props.title ?? ""} onChange={(e) => onChange({ ...props, title: nullable(e.target.value) })} />
      </Field>
      <Field label={g.images} hint={g.imagesHint} error={errors.image_media_ids}>
        <ul className="grid grid-cols-3 gap-2">
          {props.image_media_ids.map((id, i) => (
            <li key={id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- media library thumbnail */}
              <img src={pick(media[String(id)], "thumb") ?? ""} alt="" className="size-full object-cover" />
              <span className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
                <button type="button" aria-label={ar.design.builder.moveHint} disabled={i === 0} onClick={() => onChange({ ...props, image_media_ids: move(props.image_media_ids, i, i - 1) })} className="rounded bg-ink/70 p-1 text-white disabled:opacity-30">
                  <ArrowUp className="size-3" />
                </button>
                <button type="button" aria-label={g.remove} onClick={() => onChange({ ...props, image_media_ids: props.image_media_ids.filter((x) => x !== id) })} className="rounded bg-danger p-1 text-white">
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Field>
      {props.image_media_ids.length < 12 ? (
        <Button variant="outline" onClick={() => setPicking(true)}>
          <Plus />
          {g.add}
        </Button>
      ) : null}
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        max={12}
        already={props.image_media_ids.length}
        onPick={(items) => {
          items.forEach(onMedia);
          const ids = items.map((item) => item.id).filter((id) => !props.image_media_ids.includes(id));
          onChange({ ...props, image_media_ids: [...props.image_media_ids, ...ids].slice(0, 12) });
        }}
      />
    </div>
  );
}

export function FaqForm({ props, onChange, errors }: { props: FaqProps; onChange: (p: FaqProps) => void; errors: Errors }) {
  const f = t.faq;
  const setItem = (i: number, patch: Partial<FaqProps["items"][number]>) => onChange({ ...props, items: props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-4">
      <Field label={f.title} htmlFor="faq-title" error={errors.title} optional>
        <Input id="faq-title" maxLength={80} value={props.title ?? ""} onChange={(e) => onChange({ ...props, title: nullable(e.target.value) })} />
      </Field>
      {props.items.map((item, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center gap-1">
            <span className="flex-1 text-sm font-semibold">{f.item(i + 1)}</span>
            <Button size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => onChange({ ...props, items: move(props.items, i, i - 1) })} aria-label={ar.design.builder.moveUp}>
              <ArrowUp />
            </Button>
            <Button size="icon-sm" variant="ghost" disabled={i === props.items.length - 1} onClick={() => onChange({ ...props, items: move(props.items, i, i + 1) })} aria-label={ar.design.builder.moveDown}>
              <ArrowDown />
            </Button>
            {props.items.length > 1 ? (
              <Button size="icon-sm" variant="danger-ghost" onClick={() => onChange({ ...props, items: props.items.filter((_, j) => j !== i) })} aria-label={f.remove}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
          <Field label={f.question} htmlFor={`faq-q-${i}`} error={errors[`items.${i}.question`]} required>
            <Input id={`faq-q-${i}`} maxLength={150} value={item.question} onChange={(e) => setItem(i, { question: e.target.value })} />
          </Field>
          <Field label={f.answer} htmlFor={`faq-a-${i}`} error={errors[`items.${i}.answer`]} required>
            <Textarea id={`faq-a-${i}`} rows={3} maxLength={600} value={item.answer} onChange={(e) => setItem(i, { answer: e.target.value })} />
          </Field>
        </div>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      {props.items.length < 12 ? (
        <Button variant="outline" onClick={() => onChange({ ...props, items: [...props.items, { question: "", answer: "" }] })}>
          <Plus />
          {f.add}
        </Button>
      ) : null}
    </div>
  );
}

export function OrderFormForm({ props, onChange, errors }: { props: OrderFormProps; onChange: (p: OrderFormProps) => void; errors: Errors }) {
  const f = t.form;
  const setField = (key: (typeof SWITCHABLE)[number], patch: Partial<{ enabled: boolean; required: boolean }>) => {
    const next = { ...props.fields[key], ...patch };
    if (!next.enabled) next.required = false;
    onChange({ ...props, fields: { ...props.fields, [key]: next } });
  };
  return (
    <div className="flex flex-col gap-4">
      <Field label={f.title} htmlFor="form-title" error={errors.title} required>
        <Input id="form-title" maxLength={80} value={props.title} onChange={(e) => onChange({ ...props, title: e.target.value })} />
      </Field>
      <Field label={f.subtitle} htmlFor="form-subtitle" error={errors.subtitle} optional>
        <Input id="form-subtitle" maxLength={200} value={props.subtitle ?? ""} onChange={(e) => onChange({ ...props, subtitle: nullable(e.target.value) })} />
      </Field>
      <Field label={f.button} htmlFor="form-button" error={errors.button_label} required>
        <Input id="form-button" maxLength={40} value={props.button_label} onChange={(e) => onChange({ ...props, button_label: e.target.value })} />
      </Field>
      <SwitchRow title={f.offerPicker} description={f.offerPickerHint} checked={props.offer_picker} onCheckedChange={(v) => onChange({ ...props, offer_picker: v })} />
      <SwitchRow title={f.showQuantity} checked={props.show_quantity} onCheckedChange={(v) => onChange({ ...props, show_quantity: v })} />
      <Field label={f.fields} hint={f.fieldsHint}>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {SWITCHABLE.map((key) => {
            const value = props.fields[key];
            return (
              <li key={key} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <label className="flex flex-1 items-center gap-2">
                  <Checkbox checked={value.enabled} onCheckedChange={(v) => setField(key, { enabled: v === true })} />
                  {f.fieldNames[key]}
                </label>
                <label className={cn("flex items-center gap-1.5 text-xs text-ink-2", !value.enabled && "opacity-40")}>
                  <Checkbox checked={value.required} disabled={!value.enabled} onCheckedChange={(v) => setField(key, { required: v === true })} />
                  {f.required}
                </label>
              </li>
            );
          })}
        </ul>
      </Field>
    </div>
  );
}

/* ---------- theme ---------- */

type SettingsProps = { settings: Settings; onChange: (s: Settings) => void; errors: Errors };

export function LookForm({ settings, onChange, errors, media, onMedia }: SettingsProps & { media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void }) {
  const same = (c: Colors) => (Object.keys(c) as Array<keyof Colors>).every((k) => c[k].toLowerCase() === settings.colors[k].toLowerCase());
  return (
    <div className="flex flex-col gap-5">
      <Field label={th.palettes}>
        <div className="grid grid-cols-3 gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange({ ...settings, colors: { ...p.colors } })}
              className={cn("flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs", same(p.colors) ? "border-brand bg-brand-soft/60" : "border-border hover:bg-surface-2")}
              aria-pressed={same(p.colors)}
            >
              <span className="flex overflow-hidden rounded-md border border-border">
                {(["primary", "secondary", "background", "text"] as const).map((k) => (
                  <span key={k} className="size-5" style={{ background: p.colors[k] }} />
                ))}
              </span>
              <span className="flex items-center gap-1">
                {same(p.colors) ? <Check className="size-3" /> : null}
                {th.paletteNames[p.key as keyof typeof th.paletteNames]}
              </span>
            </button>
          ))}
        </div>
      </Field>
      {(["primary", "secondary", "background", "text"] as const).map((key) => (
        <Field key={key} label={th.colors[key]} error={errors[`colors.${key}`]}>
          <ColorInput value={settings.colors[key]} onChange={(v) => onChange({ ...settings, colors: { ...settings.colors, [key]: v.toLowerCase() } })} />
        </Field>
      ))}
      <Field label={th.font} htmlFor="lp-font" error={errors.font}>
        <Select id="lp-font" value={settings.font} onValueChange={(v) => onChange({ ...settings, font: v as FontKey })} options={(Object.keys(FONTS) as FontKey[]).map((k) => ({ value: k, label: FONTS[k].label }))} searchable={false} />
      </Field>
      <Field label={th.fontSize} error={errors.font_size}>
        <Segmented value={settings.font_size} onChange={(v) => onChange({ ...settings, font_size: v as FontSize })} options={(["small", "medium", "large"] as const).map((k) => ({ value: k, label: th.fontSizes[k] }))} />
      </Field>
      <Field label={t.look.button} error={errors.button}>
        <Segmented value={settings.button} onChange={(v) => onChange({ ...settings, button: v as ButtonShape })} options={(["rounded", "pill", "square"] as const).map((k) => ({ value: k, label: t.look.buttons[k] }))} />
      </Field>
      <Field label={th.logo} hint={th.logoHint} error={errors.logo_media_id}>
        <ImageField
          value={imageOf(media, settings.logo_media_id)}
          onChange={(item) => {
            if (item) onMedia(item);
            onChange({ ...settings, logo_media_id: item?.id ?? null });
          }}
        />
      </Field>
    </div>
  );
}

export function HeaderForm({ settings, onChange, errors }: SettingsProps) {
  const set = (patch: Partial<Settings["header"]>) => onChange({ ...settings, header: { ...settings.header, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow title={t.header.show} checked={settings.header.show} onCheckedChange={(v) => set({ show: v })} />
      <Field label={th.announcement} htmlFor="lp-announcement" hint={th.announcementHint} error={errors["header.announcement"]} optional>
        <Input id="lp-announcement" maxLength={200} value={settings.header.announcement ?? ""} onChange={(e) => set({ announcement: nullable(e.target.value) })} />
      </Field>
    </div>
  );
}

export function FooterForm({ settings, onChange, errors }: SettingsProps) {
  const f = settings.footer;
  const set = (patch: Partial<Settings["footer"]>) => onChange({ ...settings, footer: { ...f, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <Field label={t.footer.text} htmlFor="lp-ftext" error={errors["footer.text"]} optional>
        <Textarea id="lp-ftext" rows={3} maxLength={300} value={f.text ?? ""} onChange={(e) => set({ text: nullable(e.target.value) })} />
      </Field>
      <Field label={t.footer.phone} htmlFor="lp-fphone" error={errors["footer.phone"]} optional>
        <Input id="lp-fphone" dir="ltr" maxLength={30} value={f.phone ?? ""} onChange={(e) => set({ phone: nullable(e.target.value) })} />
      </Field>
      <Field label={t.footer.whatsapp} htmlFor="lp-fwa" error={errors["footer.whatsapp"]} optional>
        <Input id="lp-fwa" dir="ltr" maxLength={30} value={f.whatsapp ?? ""} onChange={(e) => set({ whatsapp: nullable(e.target.value) })} />
      </Field>
      <Field label={t.footer.social}>
        <div className="flex flex-col gap-2">
          {SOCIALS.map((s) => (
            <div key={s}>
              <label className="flex items-center gap-2">
                <SocialIcon network={s} className="size-4 shrink-0 text-ink-2" />
                <Input dir="ltr" maxLength={300} placeholder={th.socialPlaceholder} value={f.social[s] ?? ""} onChange={(e) => set({ social: { ...f.social, [s]: nullable(e.target.value) } })} aria-label={ar.storefront.social[s]} />
              </label>
              {errors[`footer.social.${s}`] ? <p className="mt-1 text-xs text-danger">{errors[`footer.social.${s}`]}</p> : null}
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}

export function GeneralForm({ settings, onChange }: SettingsProps) {
  const set = (patch: Partial<Settings["general"]>) => onChange({ ...settings, general: { ...settings.general, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow title={t.general.sticky} description={t.general.stickyHint} checked={settings.general.sticky_order_button} onCheckedChange={(v) => set({ sticky_order_button: v })} />
      <SwitchRow title={t.general.whatsapp} description={t.general.whatsappHint} checked={settings.general.whatsapp_button} onCheckedChange={(v) => set({ whatsapp_button: v })} />
    </div>
  );
}
