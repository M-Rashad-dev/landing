"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { ColorInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { RadioCards, SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { Card, move } from "@/features/builder/section-forms";
import { ImageField } from "@/features/media/image-fields";
import type { ProductOffer } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import type { Colors } from "@/themes/shared/design";
import { SUFI_LANDING_ICONS } from "@/themes/landing/sufi/icons";
import { setBuilderScheme, useBuilderScheme } from "@/themes/landing/sufi/root";
import type {
  CountdownProps,
  DetailsProps,
  FeaturesProps,
  HeroProps,
  MarqueeProps,
  OrderFormProps,
  PromisesProps,
  SpecsProps,
  StatsProps,
  SufiLandingSection,
  SufiLandingSectionType,
  SufiLandingSettings,
  VideoProps,
} from "@/themes/landing/sufi/types";
import { newId } from "./builder-api";
import { FaqForm, GalleryForm, OrderFormForm } from "./builder-forms";
import { BundlesForm, DateTime, IconItems, imageOf, ImagePick, Text, TestimonialsForm, TextList, under, type Errors, type Media } from "./form-kit";

const t = ar.landings.builder.forms;
const s = ar.landings.builder.sufi;
const th = ar.design.theme;

/** Sections a merchant can add to a «صوفي» page (the order form is always there, once). */
export const SUFI_LANDING_ADDABLE: Exclude<SufiLandingSectionType, "order_form">[] = ["hero", "marquee", "features", "details", "specs", "gallery", "video", "bundles", "stats", "testimonials", "countdown", "promises", "faq"];

/* ---------- sections ---------- */

function HeroForm({ props, onChange, errors, media, onMedia }: { props: HeroProps; onChange: (p: HeroProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<HeroProps>) => onChange({ ...props, ...patch });
  const h = ar.landings.builder.hero;
  return (
    <div className="flex flex-col gap-4">
      <Field label={s.layout} error={errors.layout}>
        <RadioCards className="sm:grid-cols-2" value={props.layout} onValueChange={(v) => set({ layout: v as HeroProps["layout"] })} options={(["split", "cover"] as const).map((k) => ({ value: k, title: s.layouts[k].title, description: s.layouts[k].description }))} />
      </Field>
      <Text id="sl-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="sl-title" label={t.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} max={120} required area error={errors.title} />
      <Text id="sl-highlight" label={t.highlight} hint={t.highlightHint} value={props.highlight} onChange={(highlight) => set({ highlight })} max={60} error={errors.highlight} />
      <Text id="sl-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={300} area error={errors.subtitle} />
      <ImagePick label={h.image} hint={h.imageHint} id={props.image_media_id} onChange={(image_media_id) => set({ image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
      <SwitchRow title={h.showPrice} checked={props.show_price} onCheckedChange={(show_price) => set({ show_price })} />
      <SwitchRow title={t.showRating} checked={props.show_rating} onCheckedChange={(show_rating) => set({ show_rating })} />
      <Text id="sl-button" label={h.button} value={props.button_label} onChange={(v) => set({ button_label: v ?? "" })} max={40} required error={errors.button_label} />
      <Text id="sl-second" label={t.second} hint={t.secondHint} value={props.second_label} onChange={(second_label) => set({ second_label })} max={40} error={errors.second_label} />
      <TextList id="sl-badges" label={s.badges} hint={s.badgesHint} values={props.badges} onChange={(badges) => set({ badges })} max={3} length={30} error={errors.badges} errors={under(errors, "badges")} />
    </div>
  );
}

function MarqueeForm({ props, onChange, errors }: { props: MarqueeProps; onChange: (p: MarqueeProps) => void; errors: Errors }) {
  return <TextList id="sl-marquee" label={t.items} values={props.items} onChange={(items) => onChange({ items })} max={10} length={40} min={1} error={errors.items} errors={under(errors, "items")} />;
}

function FeaturesForm({ props, onChange, errors }: { props: FeaturesProps; onChange: (p: FeaturesProps) => void; errors: Errors }) {
  const set = (patch: Partial<FeaturesProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="sf-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="sf-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="sf-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={200} error={errors.subtitle} />
      <IconItems items={props.items} onChange={(items) => set({ items })} icons={SUFI_LANDING_ICONS} fallback="gem" errors={errors} min={2} max={6} label={t.feature} />
    </div>
  );
}

function DetailsForm({ props, onChange, errors, media, onMedia }: { props: DetailsProps; onChange: (p: DetailsProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<DetailsProps>) => onChange({ ...props, ...patch });
  const setRow = (i: number, patch: Partial<DetailsProps["rows"][number]>) => set({ rows: props.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="dt-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="dt-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      {props.rows.map((row, i) => (
        <Card
          key={i}
          title={s.row(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ rows: move(props.rows, i, i - 1) }) : undefined}
          onDown={i < props.rows.length - 1 ? () => set({ rows: move(props.rows, i, i + 1) }) : undefined}
          onRemove={props.rows.length > 1 ? () => set({ rows: props.rows.filter((_, j) => j !== i) }) : undefined}
        >
          <ImagePick label={t.image} hint={t.imageHint} id={row.image_media_id} onChange={(image_media_id) => setRow(i, { image_media_id })} media={media} onMedia={onMedia} error={errors[`rows.${i}.image_media_id`]} />
          <Text id={`dt-t-${i}`} label={s.rowTitle} value={row.title} onChange={(v) => setRow(i, { title: v ?? "" })} max={60} required error={errors[`rows.${i}.title`]} />
          <Text id={`dt-x-${i}`} label={s.rowText} value={row.text} onChange={(text) => setRow(i, { text })} max={400} area error={errors[`rows.${i}.text`]} />
          <TextList id={`dt-p-${i}`} label={t.points} values={row.points} onChange={(points) => setRow(i, { points })} max={5} length={60} error={errors[`rows.${i}.points`]} errors={under(errors, `rows.${i}.points`)} />
        </Card>
      ))}
      {errors.rows ? <p className="text-xs text-danger">{errors.rows}</p> : null}
      {props.rows.length < 4 ? (
        <Button variant="outline" onClick={() => set({ rows: [...props.rows, { image_media_id: null, title: s.row(props.rows.length + 1), text: null, points: [] }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
    </div>
  );
}

function SpecsForm({ props, onChange, errors, media, onMedia }: { props: SpecsProps; onChange: (p: SpecsProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<SpecsProps>) => onChange({ ...props, ...patch });
  const setRow = (i: number, patch: Partial<SpecsProps["rows"][number]>) => set({ rows: props.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="sp-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="sp-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <ImagePick label={s.specImage} hint={s.specImageHint} id={props.image_media_id} onChange={(image_media_id) => set({ image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
      {props.rows.map((row, i) => (
        <Card
          key={i}
          title={s.specRow(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ rows: move(props.rows, i, i - 1) }) : undefined}
          onDown={i < props.rows.length - 1 ? () => set({ rows: move(props.rows, i, i + 1) }) : undefined}
          onRemove={props.rows.length > 2 ? () => set({ rows: props.rows.filter((_, j) => j !== i) }) : undefined}
        >
          <div className="grid grid-cols-2 gap-3">
            <Text id={`sp-l-${i}`} label={s.specLabel} value={row.label} onChange={(v) => setRow(i, { label: v ?? "" })} max={40} required error={errors[`rows.${i}.label`]} />
            <Text id={`sp-v-${i}`} label={s.specValue} value={row.value} onChange={(v) => setRow(i, { value: v ?? "" })} max={80} required error={errors[`rows.${i}.value`]} />
          </div>
        </Card>
      ))}
      {errors.rows ? <p className="text-xs text-danger">{errors.rows}</p> : null}
      {props.rows.length < 12 ? (
        <Button variant="outline" onClick={() => set({ rows: [...props.rows, { label: "", value: "" }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
      <Text id="sp-note" label={s.note} value={props.note} onChange={(note) => set({ note })} max={160} error={errors.note} />
    </div>
  );
}

function VideoForm({ props, onChange, errors, media, onMedia }: { props: VideoProps; onChange: (p: VideoProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<VideoProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="sv-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="sv-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={200} error={errors.subtitle} />
      <Field label={t.videoUrl} hint={t.videoUrlHint} htmlFor="sv-url" error={errors.url} required>
        <Input id="sv-url" dir="ltr" maxLength={300} value={props.url} onChange={(e) => set({ url: e.target.value })} />
      </Field>
      <ImagePick label={t.cover} hint={t.coverHint} id={props.cover_media_id} onChange={(cover_media_id) => set({ cover_media_id })} media={media} onMedia={onMedia} error={errors.cover_media_id} />
    </div>
  );
}

function StatsForm({ props, onChange, errors }: { props: StatsProps; onChange: (p: StatsProps) => void; errors: Errors }) {
  const set = (patch: Partial<StatsProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<StatsProps["items"][number]>) => set({ items: props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="ss-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="ss-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={s.stat(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 2 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
        >
          <Text id={`ss-v-${i}`} label={s.statValue} hint={s.statValueHint} value={item.value} onChange={(v) => setItem(i, { value: v ?? "" })} max={16} required error={errors[`items.${i}.value`]} />
          <Text id={`ss-l-${i}`} label={s.statLabel} value={item.label} onChange={(v) => setItem(i, { label: v ?? "" })} max={40} required error={errors[`items.${i}.label`]} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      {props.items.length < 4 ? (
        <Button variant="outline" onClick={() => set({ items: [...props.items, { value: "", label: "" }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
    </div>
  );
}

function CountdownForm({ props, onChange, errors }: { props: CountdownProps; onChange: (p: CountdownProps) => void; errors: Errors }) {
  const set = (patch: Partial<CountdownProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="sc-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="sc-title" label={t.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} max={80} required error={errors.title} />
      <Text id="sc-text" label={t.subtitle} value={props.text} onChange={(text) => set({ text })} max={160} error={errors.text} />
      <Field label={t.endsAt} hint={t.endsAtHint} htmlFor="sc-ends" error={errors.ends_at} optional>
        <DateTime id="sc-ends" value={props.ends_at} onChange={(ends_at) => set({ ends_at })} />
      </Field>
      <SwitchRow title={t.showStock} description={t.showStockHint} checked={props.show_stock} onCheckedChange={(show_stock) => set({ show_stock })} />
    </div>
  );
}

function SufiOrderForm({ props, onChange, errors, media, onMedia }: { props: OrderFormProps; onChange: (p: OrderFormProps) => void; errors: Errors } & Media) {
  return (
    <div className="flex flex-col gap-4">
      <Text id="so-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => onChange({ ...props, kicker })} max={60} error={errors.kicker} />
      <OrderFormForm props={props} onChange={(p) => onChange({ ...props, ...p })} errors={errors} />
      <TextList id="so-points" label={t.formPoints} values={props.points} onChange={(points) => onChange({ ...props, points })} max={5} length={60} error={errors.points} errors={under(errors, "points")} />
      <ImagePick label={t.formImage} hint={t.imageHint} id={props.image_media_id} onChange={(image_media_id) => onChange({ ...props, image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
    </div>
  );
}

function PromisesForm({ props, onChange, errors }: { props: PromisesProps; onChange: (p: PromisesProps) => void; errors: Errors }) {
  return <IconItems items={props.items} onChange={(items) => onChange({ items })} icons={SUFI_LANDING_ICONS} fallback="truck" errors={errors} min={2} max={4} length={120} label={s.promise} />;
}

/** A shared form («بداية»'s gallery, questions) with this theme's kicker above it. */
function WithKicker<P extends { kicker: string | null }>({ id, props, onChange, errors, children }: { id: string; props: P; onChange: (p: P) => void; errors: Errors; children: (set: (patch: Omit<P, "kicker">) => void) => React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Text id={`${id}-kicker`} label={t.kicker} value={props.kicker} onChange={(kicker) => onChange({ ...props, kicker })} max={60} error={errors.kicker} />
      {children((patch) => onChange({ ...props, ...patch }))}
    </div>
  );
}

export function SufiLandingSectionForm({ section, errors, onChange, media, onMedia, offers }: { section: SufiLandingSection; errors: Errors; onChange: (props: SufiLandingSection["props"]) => void; offers: ProductOffer[] } & Media) {
  const m = { media, onMedia };
  switch (section.type) {
    case "hero":
      return <HeroForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "marquee":
      return <MarqueeForm props={section.props} onChange={onChange} errors={errors} />;
    case "features":
      return <FeaturesForm props={section.props} onChange={onChange} errors={errors} />;
    case "details":
      return <DetailsForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "specs":
      return <SpecsForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "gallery":
      return <WithKicker id="sg" props={section.props} onChange={onChange} errors={errors}>{(set) => <GalleryForm props={section.props} onChange={set} errors={errors} {...m} />}</WithKicker>;
    case "video":
      return <VideoForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "bundles":
      return <BundlesForm props={section.props} onChange={onChange} errors={errors} offers={offers} {...m} />;
    case "stats":
      return <StatsForm props={section.props} onChange={onChange} errors={errors} />;
    case "testimonials":
      return <TestimonialsForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "countdown":
      return <CountdownForm props={section.props} onChange={onChange} errors={errors} />;
    case "order_form":
      return <SufiOrderForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "promises":
      return <PromisesForm props={section.props} onChange={onChange} errors={errors} />;
    case "faq":
      return <WithKicker id="sq" props={section.props} onChange={onChange} errors={errors}>{(set) => <FaqForm props={section.props} onChange={set} errors={errors} />}</WithKicker>;
  }
}

/* ---------- theme settings (beside «بداية»'s own forms) ---------- */

type SettingsProps = { settings: SufiLandingSettings; onChange: (settings: SufiLandingSettings) => void; errors: Errors } & Media;

export function SufiLookExtras({ settings, onChange, errors, media, onMedia }: SettingsProps) {
  const preview = useBuilderScheme();
  const setDark = (key: keyof Colors, value: string) => onChange({ ...settings, colors_dark: { ...settings.colors_dark, [key]: value.toLowerCase() } });
  return (
    <div className="flex flex-col gap-5 border-t border-border pt-4">
      <SwitchRow title={s.displayFont} description={s.displayFontHint} checked={settings.display_font} onCheckedChange={(display_font) => onChange({ ...settings, display_font })} />
      <p className="text-sm font-semibold">{s.darkColors}</p>
      <SwitchRow title={s.darkPreview} description={s.darkPreviewHint} checked={preview === "dark"} onCheckedChange={(on) => setBuilderScheme(on ? "dark" : "light")} />
      {(["primary", "secondary", "background", "text"] as const).map((key) => (
        <Field key={key} label={th.colors[key]} error={errors[`colors_dark.${key}`]}>
          <ColorInput value={settings.colors_dark[key]} onChange={(v) => setDark(key, v)} />
        </Field>
      ))}
      <Field label={s.appearance} error={errors["appearance.default"]}>
        <Segmented value={settings.appearance.default} onChange={(v) => onChange({ ...settings, appearance: { ...settings.appearance, default: v } })} options={(["light", "dark", "system"] as const).map((k) => ({ value: k, label: s.appearances[k] }))} />
      </Field>
      <SwitchRow title={s.toggle} description={s.toggleHint} checked={settings.appearance.toggle} onCheckedChange={(toggle) => onChange({ ...settings, appearance: { ...settings.appearance, toggle } })} />
      <Field label={s.logoDark} hint={s.logoDarkHint} error={errors.logo_dark_media_id}>
        <ImageField
          value={imageOf(media, settings.logo_dark_media_id)}
          onChange={(item) => {
            if (item) onMedia(item);
            onChange({ ...settings, logo_dark_media_id: item?.id ?? null });
          }}
        />
      </Field>
    </div>
  );
}

export function SufiHeaderExtras({ settings, onChange, errors }: SettingsProps) {
  return <Text id="sl-hb" label={s.headerButton} hint={s.headerButtonHint} value={settings.header.button_label} onChange={(button_label) => onChange({ ...settings, header: { ...settings.header, button_label } })} max={40} error={errors["header.button_label"]} />;
}

export function SufiGeneralExtras({ settings, onChange }: SettingsProps) {
  return <SwitchRow title={s.animations} description={s.animationsHint} checked={settings.general.animations} onCheckedChange={(animations) => onChange({ ...settings, general: { ...settings.general, animations } })} />;
}

/* ---------- a new section, ready to edit ---------- */

export function newSufiLandingSection(type: Exclude<SufiLandingSectionType, "order_form">, productName: string | null): SufiLandingSection {
  const id = newId();
  const title = ar.landings.builder.types[type].title;
  switch (type) {
    case "hero":
      return { id, type, visible: true, props: { layout: "split", kicker: null, title: productName ?? title, highlight: null, subtitle: null, image_media_id: null, show_price: true, show_rating: true, button_label: ar.bidaya.orderNow, second_label: null, badges: [] } };
    case "marquee":
      return { id, type, visible: true, props: { items: [title] } };
    case "features":
      return { id, type, visible: true, props: { kicker: null, title, subtitle: null, items: [{ icon: "gem", title: t.feature(1), text: null }, { icon: "award", title: t.feature(2), text: null }] } };
    case "details":
      return { id, type, visible: true, props: { kicker: null, title, rows: [{ image_media_id: null, title: s.row(1), text: null, points: [] }] } };
    case "specs":
      return { id, type, visible: true, props: { kicker: null, title, image_media_id: null, rows: [{ label: s.specLabel, value: s.specValue }, { label: s.specLabel, value: s.specValue }], note: null } };
    case "gallery":
      return { id, type, visible: true, props: { kicker: null, title, image_media_ids: [] } };
    case "video":
      return { id, type, visible: true, props: { title, subtitle: null, url: "", cover_media_id: null } };
    case "bundles":
      return { id, type, visible: true, props: { kicker: null, title, subtitle: null, cards: [] } };
    case "stats":
      return { id, type, visible: true, props: { kicker: null, title: null, items: [{ value: "1", label: s.statLabel }, { value: "2", label: s.statLabel }] } };
    case "testimonials":
      return { id, type, visible: true, props: { kicker: null, title, source: "auto", items: [], show_score: true } };
    case "countdown":
      return { id, type, visible: true, props: { kicker: null, title, text: null, ends_at: new Date(Date.now() + 2 * 86400000).toISOString(), show_stock: false } };
    case "promises":
      return { id, type, visible: true, props: { items: [{ icon: "truck", title: s.promise(1), text: null }, { icon: "cash", title: s.promise(2), text: null }] } };
    case "faq":
      return { id, type, visible: true, props: { kicker: null, title, items: [{ question: ar.landings.builder.faq.question, answer: ar.landings.builder.faq.answer }] } };
  }
}
