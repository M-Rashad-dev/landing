"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { ColorInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ColorChoice } from "@/features/builder/rawaq-forms";
import { Card, move } from "@/features/builder/section-forms";
import type { ProductOffer } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import { RAWAQ_LANDING_ICONS } from "@/themes/landing/rawaq/icons";
import type {
  BeforeAfterProps,
  BenefitsProps,
  CountdownProps,
  HeroProps,
  HowToProps,
  IngredientsProps,
  OrderFormProps,
  PromisesProps,
  RawaqLandingSection,
  RawaqLandingSectionType,
  RawaqLandingSettings,
  StatsProps,
  SuitsProps,
  TrustProps,
  VideoProps,
} from "@/themes/landing/rawaq/types";
import { newId } from "./builder-api";
import { FaqForm, GalleryForm, OrderFormForm } from "./builder-forms";
import { BundlesForm, DateTime, IconItems, IconPicker, ImagePick, Text, TestimonialsForm, TextList, under, type Errors, type Media } from "./form-kit";

const t = ar.landings.builder.forms;
const r = ar.landings.builder.rawaq;
const s = ar.landings.builder.sufi;
const rd = ar.design.rawaq;

/** Sections a merchant can add to a «رواق» page (the order form is always there, once). */
export const RAWAQ_LANDING_ADDABLE: Array<Exclude<RawaqLandingSectionType, "order_form" | "ai">> = [
  "hero", "trust", "benefits", "before_after", "ingredients", "how_to", "suits", "bundles", "stats", "gallery", "video", "testimonials", "countdown", "promises", "faq",
];

/* ---------- sections ---------- */

function HeroForm({ props, onChange, errors, media, onMedia }: { props: HeroProps; onChange: (p: HeroProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<HeroProps>) => onChange({ ...props, ...patch });
  const h = ar.landings.builder.hero;
  return (
    <div className="flex flex-col gap-4">
      <Text id="rl-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="rl-title" label={t.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} max={120} required area error={errors.title} />
      <Text id="rl-highlight" label={t.highlight} hint={t.highlightHint} value={props.highlight} onChange={(highlight) => set({ highlight })} max={60} error={errors.highlight} />
      <Text id="rl-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={300} area error={errors.subtitle} />
      <ImagePick label={h.image} hint={h.imageHint} id={props.image_media_id} onChange={(image_media_id) => set({ image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
      <Text id="rl-badge" label={r.badge} hint={r.badgeHint} value={props.badge} onChange={(badge) => set({ badge })} max={20} error={errors.badge} />
      <SwitchRow title={h.showPrice} checked={props.show_price} onCheckedChange={(show_price) => set({ show_price })} />
      <SwitchRow title={t.showRating} checked={props.show_rating} onCheckedChange={(show_rating) => set({ show_rating })} />
      <Text id="rl-button" label={h.button} value={props.button_label} onChange={(v) => set({ button_label: v ?? "" })} max={40} required error={errors.button_label} />
      <Text id="rl-second" label={t.second} hint={t.secondHint} value={props.second_label} onChange={(second_label) => set({ second_label })} max={40} error={errors.second_label} />
      <TextList id="rl-chips" label={r.chips} hint={r.chipsHint} values={props.chips} onChange={(chips) => set({ chips })} max={4} length={30} error={errors.chips} errors={under(errors, "chips")} />
    </div>
  );
}

function TrustForm({ props, onChange, errors }: { props: TrustProps; onChange: (p: TrustProps) => void; errors: Errors }) {
  return <IconItems items={props.items} onChange={(items) => onChange({ items })} icons={RAWAQ_LANDING_ICONS} fallback="shield" errors={errors} min={2} max={4} length={80} label={r.trustItem} />;
}

function BenefitsForm({ props, onChange, errors }: { props: BenefitsProps; onChange: (p: BenefitsProps) => void; errors: Errors }) {
  const set = (patch: Partial<BenefitsProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<BenefitsProps["items"][number]>) => set({ items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="rb-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="rb-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={r.benefit(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 2 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
        >
          <Field label={t.icon}>
            <IconPicker value={item.icon} onChange={(icon) => setItem(i, { icon })} icons={RAWAQ_LANDING_ICONS} />
          </Field>
          <Text id={`rb-t-${i}`} label={t.title} value={item.title} onChange={(v) => setItem(i, { title: v ?? "" })} max={40} required error={errors[`items.${i}.title`]} />
          <Text id={`rb-x-${i}`} label={t.text} value={item.text} onChange={(text) => setItem(i, { text })} max={160} area error={errors[`items.${i}.text`]} />
          <ColorChoice id={`rb-c-${i}`} label={ar.design.rawaq.shortcuts.color} hint={ar.design.rawaq.shortcuts.colorHint} value={item.color} onChange={(color) => setItem(i, { color })} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      {props.items.length < 6 ? (
        <Button variant="outline" onClick={() => set({ items: [...props.items, { icon: "sparkle", title: r.benefit(props.items.length + 1), text: null, color: null }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
    </div>
  );
}

function BeforeAfterForm({ props, onChange, errors, media, onMedia }: { props: BeforeAfterProps; onChange: (p: BeforeAfterProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<BeforeAfterProps>) => onChange({ ...props, ...patch });
  const ba = rd.beforeAfter;
  const setFact = (i: number, patch: Partial<BeforeAfterProps["facts"][number]>) => set({ facts: props.facts.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="ra-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="ra-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="ra-text" label={t.subtitle} value={props.text} onChange={(text) => set({ text })} max={300} area error={errors.text} />
      <p className="text-xs text-ink-3">{ba.hint}</p>
      <ImagePick label={ba.before} id={props.before_media_id} onChange={(before_media_id) => set({ before_media_id })} media={media} onMedia={onMedia} error={errors.before_media_id} />
      <Text id="ra-before" label={ba.beforeLabel} value={props.before_label} onChange={(v) => set({ before_label: v ?? "" })} max={20} required error={errors.before_label} />
      <ImagePick label={ba.after} id={props.after_media_id} onChange={(after_media_id) => set({ after_media_id })} media={media} onMedia={onMedia} error={errors.after_media_id} />
      <Text id="ra-after" label={ba.afterLabel} value={props.after_label} onChange={(v) => set({ after_label: v ?? "" })} max={20} required error={errors.after_label} />
      <Field label={ba.facts} error={errors.facts}>
        <div className="flex flex-col gap-3">
          {props.facts.map((fact, i) => (
            <Card key={i} title={ba.fact(i + 1)} onRemove={() => set({ facts: props.facts.filter((_, j) => j !== i) })} removeLabel={t.remove}>
              <div className="grid grid-cols-2 gap-3">
                <Text id={`ra-${i}-v`} label={ba.value} value={fact.value} onChange={(v) => setFact(i, { value: v ?? "" })} max={12} required error={errors[`facts.${i}.value`]} />
                <Text id={`ra-${i}-l`} label={ba.label} value={fact.label} onChange={(v) => setFact(i, { label: v ?? "" })} max={40} required error={errors[`facts.${i}.label`]} />
              </div>
            </Card>
          ))}
          {props.facts.length < 3 ? (
            <Button variant="outline" onClick={() => set({ facts: [...props.facts, { value: "", label: "" }] })}>
              <Plus />
              {ba.addFact}
            </Button>
          ) : null}
        </div>
      </Field>
    </div>
  );
}

function IngredientsForm({ props, onChange, errors }: { props: IngredientsProps; onChange: (p: IngredientsProps) => void; errors: Errors }) {
  const set = (patch: Partial<IngredientsProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<IngredientsProps["items"][number]>) => set({ items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const ri = rd.ingredients;
  return (
    <div className="flex flex-col gap-4">
      <Text id="ri-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="ri-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="ri-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={200} error={errors.subtitle} />
      <p className="text-xs text-ink-3">{r.ingredientsHint}</p>
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={ri.item(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 2 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
        >
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Text id={`ri-s-${i}`} label={ri.symbol} value={item.symbol} onChange={(v) => setItem(i, { symbol: v ?? "" })} max={4} required error={errors[`items.${i}.symbol`]} />
            <Text id={`ri-n-${i}`} label={ri.name} value={item.name} onChange={(v) => setItem(i, { name: v ?? "" })} max={40} required error={errors[`items.${i}.name`]} />
          </div>
          <p className="-mt-2 text-xs text-ink-3">{ri.symbolHint}</p>
          <Text id={`ri-t-${i}`} label={ri.text} value={item.text} onChange={(text) => setItem(i, { text })} max={120} error={errors[`items.${i}.text`]} />
          <ColorChoice id={`ri-c-${i}`} label={ri.color} value={item.color} onChange={(color) => setItem(i, { color })} />
        </Card>
      ))}
      {errors.items ? <p className="text-xs text-danger">{errors.items}</p> : null}
      {props.items.length < 8 ? (
        <Button variant="outline" onClick={() => set({ items: [...props.items, { symbol: "", name: "", text: null, color: null }] })}>
          <Plus />
          {ri.add}
        </Button>
      ) : null}
    </div>
  );
}

function HowToForm({ props, onChange, errors, media, onMedia }: { props: HowToProps; onChange: (p: HowToProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<HowToProps>) => onChange({ ...props, ...patch });
  const setStep = (i: number, patch: Partial<HowToProps["steps"][number]>) => set({ steps: props.steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="rh-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="rh-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <ImagePick label={r.howToImage} hint={r.howToImageHint} id={props.image_media_id} onChange={(image_media_id) => set({ image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
      {props.steps.map((step, i) => (
        <Card
          key={i}
          title={r.step(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ steps: move(props.steps, i, i - 1) }) : undefined}
          onDown={i < props.steps.length - 1 ? () => set({ steps: move(props.steps, i, i + 1) }) : undefined}
          onRemove={props.steps.length > 2 ? () => set({ steps: props.steps.filter((_, j) => j !== i) }) : undefined}
        >
          <Text id={`rh-t-${i}`} label={r.stepTitle} value={step.title} onChange={(v) => setStep(i, { title: v ?? "" })} max={50} required error={errors[`steps.${i}.title`]} />
          <Text id={`rh-x-${i}`} label={r.stepText} value={step.text} onChange={(text) => setStep(i, { text })} max={200} area error={errors[`steps.${i}.text`]} />
          <Text id={`rh-w-${i}`} label={r.stepTime} hint={r.stepTimeHint} value={step.time} onChange={(time) => setStep(i, { time })} max={20} error={errors[`steps.${i}.time`]} />
        </Card>
      ))}
      {errors.steps ? <p className="text-xs text-danger">{errors.steps}</p> : null}
      {props.steps.length < 5 ? (
        <Button variant="outline" onClick={() => set({ steps: [...props.steps, { title: r.step(props.steps.length + 1), text: null, time: null }] })}>
          <Plus />
          {t.add}
        </Button>
      ) : null}
      <Text id="rh-note" label={r.note} value={props.note} onChange={(note) => set({ note })} max={200} error={errors.note} />
    </div>
  );
}

function SuitsForm({ props, onChange, errors }: { props: SuitsProps; onChange: (p: SuitsProps) => void; errors: Errors }) {
  const set = (patch: Partial<SuitsProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="rs-title" label={t.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} max={80} required error={errors.title} />
      <TextList id="rs-items" label={r.suitsItems} hint={r.suitsHint} values={props.items} onChange={(items) => set({ items })} max={8} length={30} min={1} error={errors.items} errors={under(errors, "items")} />
      <Text id="rs-note" label={r.note} value={props.note} onChange={(note) => set({ note })} max={200} error={errors.note} />
    </div>
  );
}

function StatsForm({ props, onChange, errors }: { props: StatsProps; onChange: (p: StatsProps) => void; errors: Errors }) {
  const set = (patch: Partial<StatsProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<StatsProps["items"][number]>) => set({ items: props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="rn-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="rn-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={s.stat(i + 1)}
          removeLabel={t.remove}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 2 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
        >
          <Text id={`rn-v-${i}`} label={s.statValue} hint={s.statValueHint} value={item.value} onChange={(v) => setItem(i, { value: v ?? "" })} max={16} required error={errors[`items.${i}.value`]} />
          <Text id={`rn-l-${i}`} label={s.statLabel} value={item.label} onChange={(v) => setItem(i, { label: v ?? "" })} max={40} required error={errors[`items.${i}.label`]} />
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

function VideoForm({ props, onChange, errors, media, onMedia }: { props: VideoProps; onChange: (p: VideoProps) => void; errors: Errors } & Media) {
  const set = (patch: Partial<VideoProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="rv-title" label={t.title} value={props.title} onChange={(title) => set({ title })} max={80} error={errors.title} />
      <Text id="rv-subtitle" label={t.subtitle} value={props.subtitle} onChange={(subtitle) => set({ subtitle })} max={200} error={errors.subtitle} />
      <Field label={t.videoUrl} hint={t.videoUrlHint} htmlFor="rv-url" error={errors.url} required>
        <Input id="rv-url" dir="ltr" maxLength={300} value={props.url} onChange={(e) => set({ url: e.target.value })} />
      </Field>
      <ImagePick label={t.cover} hint={t.coverHint} id={props.cover_media_id} onChange={(cover_media_id) => set({ cover_media_id })} media={media} onMedia={onMedia} error={errors.cover_media_id} />
    </div>
  );
}

function CountdownForm({ props, onChange, errors }: { props: CountdownProps; onChange: (p: CountdownProps) => void; errors: Errors }) {
  const set = (patch: Partial<CountdownProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="rc-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => set({ kicker })} max={60} error={errors.kicker} />
      <Text id="rc-title" label={t.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} max={80} required error={errors.title} />
      <Text id="rc-text" label={t.subtitle} value={props.text} onChange={(text) => set({ text })} max={160} error={errors.text} />
      <Field label={t.endsAt} hint={t.endsAtHint} htmlFor="rc-ends" error={errors.ends_at} optional>
        <DateTime id="rc-ends" value={props.ends_at} onChange={(ends_at) => set({ ends_at })} />
      </Field>
      <SwitchRow title={t.showStock} description={t.showStockHint} checked={props.show_stock} onCheckedChange={(show_stock) => set({ show_stock })} />
    </div>
  );
}

function RawaqOrderForm({ props, onChange, errors, media, onMedia }: { props: OrderFormProps; onChange: (p: OrderFormProps) => void; errors: Errors } & Media) {
  return (
    <div className="flex flex-col gap-4">
      <Text id="ro-kicker" label={t.kicker} value={props.kicker} onChange={(kicker) => onChange({ ...props, kicker })} max={60} error={errors.kicker} />
      <OrderFormForm props={props} onChange={(p) => onChange({ ...props, ...p })} errors={errors} />
      <TextList id="ro-points" label={t.formPoints} values={props.points} onChange={(points) => onChange({ ...props, points })} max={5} length={60} error={errors.points} errors={under(errors, "points")} />
      <ImagePick label={t.formImage} hint={t.imageHint} id={props.image_media_id} onChange={(image_media_id) => onChange({ ...props, image_media_id })} media={media} onMedia={onMedia} error={errors.image_media_id} />
    </div>
  );
}

function PromisesForm({ props, onChange, errors }: { props: PromisesProps; onChange: (p: PromisesProps) => void; errors: Errors }) {
  return <IconItems items={props.items} onChange={(items) => onChange({ items })} icons={RAWAQ_LANDING_ICONS} fallback="truck" errors={errors} min={2} max={4} length={120} label={s.promise} />;
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

export function RawaqLandingSectionForm({ section, errors, onChange, media, onMedia, offers }: { section: RawaqLandingSection; errors: Errors; onChange: (props: RawaqLandingSection["props"]) => void; offers: ProductOffer[] } & Media) {
  const m = { media, onMedia };
  switch (section.type) {
    case "hero":
      return <HeroForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "trust":
      return <TrustForm props={section.props} onChange={onChange} errors={errors} />;
    case "benefits":
      return <BenefitsForm props={section.props} onChange={onChange} errors={errors} />;
    case "before_after":
      return <BeforeAfterForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "ingredients":
      return <IngredientsForm props={section.props} onChange={onChange} errors={errors} />;
    case "how_to":
      return <HowToForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "suits":
      return <SuitsForm props={section.props} onChange={onChange} errors={errors} />;
    case "bundles":
      return <BundlesForm props={section.props} onChange={onChange} errors={errors} offers={offers} {...m} />;
    case "stats":
      return <StatsForm props={section.props} onChange={onChange} errors={errors} />;
    case "gallery":
      return <WithKicker id="rg" props={section.props} onChange={onChange} errors={errors}>{(set) => <GalleryForm props={section.props} onChange={set} errors={errors} {...m} />}</WithKicker>;
    case "video":
      return <VideoForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "testimonials":
      return <TestimonialsForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "countdown":
      return <CountdownForm props={section.props} onChange={onChange} errors={errors} />;
    case "order_form":
      return <RawaqOrderForm props={section.props} onChange={onChange} errors={errors} {...m} />;
    case "promises":
      return <PromisesForm props={section.props} onChange={onChange} errors={errors} />;
    case "faq":
      return <WithKicker id="rq" props={section.props} onChange={onChange} errors={errors}>{(set) => <FaqForm props={section.props} onChange={set} errors={errors} />}</WithKicker>;
    case "ai":
      return null;
  }
}

/* ---------- theme settings (beside «بداية»'s own forms) ---------- */

type SettingsProps = { settings: RawaqLandingSettings; onChange: (settings: RawaqLandingSettings) => void; errors: Errors };

export function RawaqLookExtras({ settings, onChange, errors }: SettingsProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={r.dark} error={errors["colors.dark"]}>
        <ColorInput value={settings.colors.dark} onChange={(v) => onChange({ ...settings, colors: { ...settings.colors, dark: v.toLowerCase() } })} />
      </Field>
      <SwitchRow title={r.displayFont} description={r.displayFontHint} checked={settings.display_font} onCheckedChange={(display_font) => onChange({ ...settings, display_font })} />
    </div>
  );
}

export function RawaqHeaderExtras({ settings, onChange, errors }: SettingsProps) {
  return <Text id="rl-hb" label={s.headerButton} hint={s.headerButtonHint} value={settings.header.button_label} onChange={(button_label) => onChange({ ...settings, header: { ...settings.header, button_label } })} max={40} error={errors["header.button_label"]} />;
}

export function RawaqGeneralExtras({ settings, onChange }: SettingsProps) {
  return <SwitchRow title={s.animations} description={s.animationsHint} checked={settings.general.animations} onCheckedChange={(animations) => onChange({ ...settings, general: { ...settings.general, animations } })} />;
}

/* ---------- a new section, ready to edit ---------- */

export function newRawaqLandingSection(type: Exclude<RawaqLandingSectionType, "order_form">, productName: string | null): RawaqLandingSection {
  const id = newId();
  const title = ar.landings.builder.types[type].title;
  switch (type) {
    case "hero":
      return { id, type, visible: true, props: { kicker: null, title: productName ?? title, highlight: null, subtitle: null, image_media_id: null, badge: null, show_price: true, show_rating: true, button_label: ar.bidaya.orderNow, second_label: null, chips: [] } };
    case "trust":
      return { id, type, visible: true, props: { items: [{ icon: "shield", title: r.trustItem(1), text: null }, { icon: "cash", title: r.trustItem(2), text: null }] } };
    case "benefits":
      return { id, type, visible: true, props: { kicker: null, title, items: [{ icon: "sparkle", title: r.benefit(1), text: null, color: null }, { icon: "droplet", title: r.benefit(2), text: null, color: null }] } };
    case "before_after":
      return { id, type, visible: true, props: { kicker: null, title, text: null, before_media_id: null, after_media_id: null, before_label: rd.beforeAfter.beforeWord, after_label: rd.beforeAfter.afterWord, facts: [] } };
    case "ingredients":
      return { id, type, visible: true, props: { kicker: null, title, subtitle: null, items: [{ symbol: "C", name: rd.ingredients.item(1), text: null, color: null }, { symbol: "HA", name: rd.ingredients.item(2), text: null, color: null }] } };
    case "how_to":
      return { id, type, visible: true, props: { kicker: null, title, image_media_id: null, steps: [{ title: r.step(1), text: null, time: null }, { title: r.step(2), text: null, time: null }], note: null } };
    case "suits":
      return { id, type, visible: true, props: { title, items: [r.suitsItems], note: null } };
    case "bundles":
      return { id, type, visible: true, props: { kicker: null, title, subtitle: null, cards: [] } };
    case "stats":
      return { id, type, visible: true, props: { kicker: null, title: null, items: [{ value: "1", label: s.statLabel }, { value: "2", label: s.statLabel }] } };
    case "gallery":
      return { id, type, visible: true, props: { kicker: null, title, image_media_ids: [] } };
    case "video":
      return { id, type, visible: true, props: { title, subtitle: null, url: "", cover_media_id: null } };
    case "testimonials":
      return { id, type, visible: true, props: { kicker: null, title, source: "auto", items: [], show_score: true } };
    case "countdown":
      return { id, type, visible: true, props: { kicker: null, title, text: null, ends_at: new Date(Date.now() + 2 * 86400000).toISOString(), show_stock: false } };
    case "promises":
      return { id, type, visible: true, props: { items: [{ icon: "truck", title: s.promise(1), text: null }, { icon: "cash", title: s.promise(2), text: null }] } };
    case "faq":
      return { id, type, visible: true, props: { kicker: null, title, items: [{ question: ar.landings.builder.faq.question, answer: ar.landings.builder.faq.answer }] } };
    case "ai":
      return { id, type: "ai", visible: true, props: { ai_section_id: 0, values: {} } };
  }
}
