"use client";

import { Plus } from "lucide-react";
import { ColorInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MultiSelect, Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { useCategories } from "@/features/catalog/categories/api";
import { useProductChoices } from "@/features/promotions/api";
import { ar } from "@/messages/ar";
import type { Link } from "@/themes/store/sufi/types";
import { RAWAQ_CARD_DEFAULTS, RAWAQ_CART_DEFAULTS, RAWAQ_LISTING_DEFAULTS, RAWAQ_PAGE_DEFAULTS, type Article, type ArticlesProps, type BeforeAfterProps, type CtaProps, type GlowHeroProps, type Ingredient, type IngredientsProps, type RawaqCardSettings, type RawaqCartSettings, type RawaqListingSettings, type RawaqPageSettings, type RawaqSettings, type Reel, type ReelsProps, type QuizAnswer, type QuizQuestion, type QuizResult, type RoutineProps, type RoutineStep, type Shortcut, type ShortcutsProps, type SkinQuizProps } from "@/themes/store/rawaq/types";
import { ImagePick, LinkField, Text, type Errors, type Media } from "./library-forms";
import { useQuizResults } from "./api";
import { Card, move } from "./section-forms";

const r = ar.design.rawaq;
const sf = ar.design.sufi;
const NONE: Link = { type: "none", target_id: null, url: null };

type Props<P> = { props: P; onChange: (p: P) => void; errors: Errors };

/** A tile's own color, or the theme's soft colors in turn. */
function ColorChoice({ id, value, onChange, label, hint }: { id: string; value: string | null; onChange: (v: string | null) => void; label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <Segmented
          value={value === null ? "auto" : "own"}
          onChange={(v) => onChange(v === "auto" ? null : (value ?? "#f6e2df"))}
          options={[
            { value: "auto", label: r.shortcuts.auto },
            { value: "own", label: r.shortcuts.own },
          ]}
        />
        {value !== null ? <ColorInput id={id} value={value} onChange={(v) => onChange(v.toLowerCase())} /> : null}
      </div>
    </Field>
  );
}

/* ---------- sections ---------- */

export function GlowHeroForm({ props, onChange, errors, media, onMedia }: Props<GlowHeroProps> & Media) {
  const set = (patch: Partial<GlowHeroProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="gh-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="gh-title" label={r.hero.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} error={errors.title} max={100} required />
      <Text id="gh-highlight" label={r.hero.highlight} hint={r.hero.highlightHint} value={props.highlight} onChange={(v) => set({ highlight: v })} error={errors.highlight} max={40} />
      <Text id="gh-subtitle" label={r.hero.subtitle} value={props.subtitle} onChange={(v) => set({ subtitle: v })} error={errors.subtitle} max={300} area />
      <ImagePick id={props.media_id} onChange={(id) => set({ media_id: id })} media={media} onMedia={onMedia} error={errors.media_id} optional />
      <Text id="gh-badge" label={r.hero.badge} hint={r.hero.badgeHint} value={props.badge} onChange={(v) => set({ badge: v })} error={errors.badge} max={20} />
      <Text id="gh-rating" label={r.hero.rating} hint={r.hero.ratingHint} value={props.rating} onChange={(v) => set({ rating: v })} error={errors.rating} max={40} />
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <Text id="gh-primary" label={r.hero.primary} value={props.primary_label} onChange={(v) => set({ primary_label: v ?? "" })} error={errors.primary_label} max={30} required />
        <LinkField value={props.primary_link} onChange={(link) => set({ primary_link: link })} errors={errors} prefix="primary_link" />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <Text id="gh-second" label={r.hero.second} value={props.second_label} onChange={(v) => set({ second_label: v })} error={errors.second_label} max={30} />
        {props.second_label ? <LinkField value={props.second_link} onChange={(link) => set({ second_link: link })} errors={errors} prefix="second_link" /> : null}
      </div>
      <Field label={r.hero.chips} optional>
        <div className="flex flex-col gap-2">
          {props.chips.map((chip, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={r.hero.chip(i + 1)} maxLength={30} value={chip} onChange={(e) => set({ chips: props.chips.map((x, j) => (j === i ? e.target.value : x)) })} />
              <Button size="sm" variant="ghost" onClick={() => set({ chips: props.chips.filter((_, j) => j !== i) })}>
                {sf.remove}
              </Button>
            </div>
          ))}
          {props.chips.length < 4 ? (
            <Button variant="outline" onClick={() => set({ chips: [...props.chips, ""] })}>
              <Plus />
              {r.hero.addChip}
            </Button>
          ) : null}
        </div>
      </Field>
    </div>
  );
}

export function ShortcutsForm({ props, onChange, errors, media, onMedia }: Props<ShortcutsProps> & Media) {
  const set = (patch: Partial<ShortcutsProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<Shortcut>) => set({ items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="sc-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="sc-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      <Text id="sc-description" label={sf.description} value={props.description} onChange={(v) => set({ description: v })} error={errors.description} max={200} />
      <Field label={r.shortcuts.style}>
        <Segmented value={props.style} onChange={(v) => set({ style: v })} options={(["circles", "cards"] as const).map((k) => ({ value: k, label: r.shortcuts.styles[k] }))} />
      </Field>
      {errors.items ? <p className="text-sm text-danger">{errors.items}</p> : null}
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={r.shortcuts.item(i + 1)}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 2 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
          removeLabel={sf.remove}
        >
          <Text id={`sc-${i}-label`} label={r.shortcuts.label} value={item.label} onChange={(v) => setItem(i, { label: v ?? "" })} error={errors[`items.${i}.label`]} max={40} required />
          <Text id={`sc-${i}-text`} label={r.shortcuts.text} hint={r.shortcuts.textHint} value={item.text} onChange={(v) => setItem(i, { text: v })} error={errors[`items.${i}.text`]} max={80} />
          <p className="text-xs text-ink-3">{r.shortcuts.linkHint}</p>
          <LinkField value={item.link} onChange={(link) => setItem(i, { link })} errors={errors} prefix={`items.${i}.link`} />
          <ColorChoice id={`sc-${i}-color`} label={r.shortcuts.color} hint={r.shortcuts.colorHint} value={item.color} onChange={(color) => setItem(i, { color })} />
          <ImagePick id={item.media_id} onChange={(id) => setItem(i, { media_id: id })} media={media} onMedia={onMedia} error={errors[`items.${i}.media_id`]} label={r.shortcuts.image} optional />
        </Card>
      ))}
      {props.items.length < 12 ? (
        <Button variant="outline" onClick={() => set({ items: [...props.items, { label: "", text: null, media_id: null, color: null, link: { type: "all_products", target_id: null, url: null } }] })}>
          <Plus />
          {r.shortcuts.add}
        </Button>
      ) : null}
    </div>
  );
}

export function RoutineForm({ props, onChange, errors }: Props<RoutineProps>) {
  const products = useProductChoices();
  const options = (products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }));
  const set = (patch: Partial<RoutineProps>) => onChange({ ...props, ...patch });
  const setStep = (i: number, patch: Partial<RoutineStep>) => set({ steps: props.steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="rt-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="rt-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} error={errors.title} max={80} required />
      <Text id="rt-text" label={sf.text} value={props.text} onChange={(v) => set({ text: v })} error={errors.text} max={300} area />
      <Text id="rt-button" label={sf.buttonLabel} hint={r.routine.buttonHint} value={props.button_label} onChange={(v) => set({ button_label: v })} error={errors.button_label} max={30} />
      <p className="text-xs text-ink-3">{r.routine.priceHint}</p>
      {products.isSuccess && options.length === 0 ? <p className="text-sm text-warning">{r.routine.noProducts}</p> : null}
      <Field label={r.routine.steps} error={errors.steps} required>
        <div className="flex flex-col gap-3">
          {props.steps.map((step, i) => (
            <Card
              key={i}
              title={r.routine.step(i + 1)}
              onUp={i > 0 ? () => set({ steps: move(props.steps, i, i - 1) }) : undefined}
              onDown={i < props.steps.length - 1 ? () => set({ steps: move(props.steps, i, i + 1) }) : undefined}
              onRemove={() => set({ steps: props.steps.filter((_, j) => j !== i) })}
              removeLabel={sf.remove}
            >
              <Field label={r.routine.product} error={errors[`steps.${i}.product_id`]} required>
                <Select aria-label={r.routine.product} value={step.product_id ? String(step.product_id) : ""} onValueChange={(v) => setStep(i, { product_id: Number(v) })} options={options} placeholder={r.routine.product} />
              </Field>
              <Text id={`rt-${i}-label`} label={r.routine.label} hint={r.routine.labelHint} value={step.label} onChange={(v) => setStep(i, { label: v })} error={errors[`steps.${i}.label`]} max={30} />
              <Text id={`rt-${i}-hint`} label={r.routine.hint} hint={r.routine.hintHint} value={step.hint} onChange={(v) => setStep(i, { hint: v })} error={errors[`steps.${i}.hint`]} max={40} />
            </Card>
          ))}
          {props.steps.length < 4 ? (
            <Button variant="outline" onClick={() => set({ steps: [...props.steps, { product_id: 0, label: null, hint: null }] })}>
              <Plus />
              {r.routine.add}
            </Button>
          ) : null}
        </div>
      </Field>
    </div>
  );
}

export function ReelsForm({ props, onChange, errors, media, onMedia }: Props<ReelsProps> & Media) {
  const set = (patch: Partial<ReelsProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<Reel>) => set({ items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="rl-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="rl-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      {errors.items ? <p className="text-sm text-danger">{errors.items}</p> : null}
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={r.reels.item(i + 1)}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={() => set({ items: props.items.filter((_, j) => j !== i) })}
          removeLabel={sf.remove}
        >
          <Field label={r.reels.url} hint={r.reels.urlHint} error={errors[`items.${i}.url`]} required>
            <Input dir="ltr" maxLength={300} placeholder="https://youtube.com/shorts/…" value={item.url} onChange={(e) => setItem(i, { url: e.target.value })} />
          </Field>
          <Text id={`rl-${i}-title`} label={r.reels.title} value={item.title} onChange={(v) => setItem(i, { title: v })} error={errors[`items.${i}.title`]} max={60} />
          <ImagePick id={item.cover_media_id} onChange={(id) => setItem(i, { cover_media_id: id })} media={media} onMedia={onMedia} error={errors[`items.${i}.cover_media_id`]} label={r.reels.cover} optional />
        </Card>
      ))}
      {props.items.length < 10 ? (
        <Button variant="outline" onClick={() => set({ items: [...props.items, { url: "", title: null, cover_media_id: null }] })}>
          <Plus />
          {r.reels.add}
        </Button>
      ) : null}
    </div>
  );
}

export function IngredientsForm({ props, onChange, errors }: Props<IngredientsProps>) {
  const set = (patch: Partial<IngredientsProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<Ingredient>) => set({ items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="in-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="in-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      <Text id="in-description" label={sf.description} value={props.description} onChange={(v) => set({ description: v })} error={errors.description} max={200} />
      {errors.items ? <p className="text-sm text-danger">{errors.items}</p> : null}
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={r.ingredients.item(i + 1)}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 2 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
          removeLabel={sf.remove}
        >
          <Text id={`in-${i}-symbol`} label={r.ingredients.symbol} hint={r.ingredients.symbolHint} value={item.symbol} onChange={(v) => setItem(i, { symbol: v ?? "" })} error={errors[`items.${i}.symbol`]} max={4} required />
          <Text id={`in-${i}-name`} label={r.ingredients.name} value={item.name} onChange={(v) => setItem(i, { name: v ?? "" })} error={errors[`items.${i}.name`]} max={40} required />
          <Text id={`in-${i}-text`} label={r.ingredients.text} value={item.text} onChange={(v) => setItem(i, { text: v })} error={errors[`items.${i}.text`]} max={100} />
          <ColorChoice id={`in-${i}-color`} label={r.ingredients.color} value={item.color} onChange={(color) => setItem(i, { color })} />
          <p className="text-xs text-ink-3">{r.ingredients.linkHint}</p>
          <LinkField value={item.link} onChange={(link) => setItem(i, { link })} errors={errors} prefix={`items.${i}.link`} />
        </Card>
      ))}
      {props.items.length < 8 ? (
        <Button variant="outline" onClick={() => set({ items: [...props.items, { symbol: "", name: "", text: null, color: null, link: NONE }] })}>
          <Plus />
          {r.ingredients.add}
        </Button>
      ) : null}
    </div>
  );
}

export function CtaForm({ props, onChange, errors }: Props<CtaProps>) {
  const set = (patch: Partial<CtaProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="ct-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} error={errors.title} max={80} required />
      <Text id="ct-text" label={sf.text} value={props.text} onChange={(v) => set({ text: v })} error={errors.text} max={200} />
      <Text id="ct-button" label={sf.buttonLabel} value={props.button_label} onChange={(v) => set({ button_label: v ?? "" })} error={errors.button_label} max={30} required />
      <Field label={r.cta.action} hint={props.action === "whatsapp" ? r.cta.whatsappHint : undefined}>
        <Segmented value={props.action} onChange={(v) => set({ action: v })} options={(["whatsapp", "link"] as const).map((k) => ({ value: k, label: r.cta.actions[k] }))} />
      </Field>
      {props.action === "whatsapp" ? (
        <Text id="ct-message" label={r.cta.message} hint={r.cta.messageHint} value={props.message} onChange={(v) => set({ message: v })} error={errors.message} max={200} />
      ) : (
        <LinkField value={props.link} onChange={(link) => set({ link })} errors={errors} prefix="link" />
      )}
    </div>
  );
}

/* ---------- settings groups ---------- */

type SettingsProps = { settings: RawaqSettings; onChange: (s: RawaqSettings) => void; errors: Errors };

export function RawaqLookExtras({ settings, onChange }: SettingsProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={r.look.dark} hint={r.look.darkHint}>
        <ColorInput id="rq-dark" value={settings.colors.dark} onChange={(v) => onChange({ ...settings, colors: { ...settings.colors, dark: v.toLowerCase() } })} />
      </Field>
      <SwitchRow title={r.look.display} description={r.look.displayHint} checked={settings.display_font} onCheckedChange={(v) => onChange({ ...settings, display_font: v })} />
      <Field label={r.look.button}>
        <Segmented value={settings.button} onChange={(v) => onChange({ ...settings, button: v })} options={(["rounded", "pill", "square"] as const).map((k) => ({ value: k, label: r.look.buttons[k] }))} />
      </Field>
    </div>
  );
}

export function RawaqHeaderExtras({ settings, onChange }: SettingsProps) {
  const h = settings.header;
  const set = (patch: Partial<RawaqSettings["header"]>) => onChange({ ...settings, header: { ...h, ...patch } });
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={r.header.layout}>
        <Segmented value={h.layout} onChange={(v) => set({ layout: v })} options={(["start", "center"] as const).map((k) => ({ value: k, label: r.header.layouts[k] }))} />
      </Field>
      <SwitchRow title={r.header.categories} description={r.header.categoriesHint} checked={h.categories_menu} onCheckedChange={(v) => set({ categories_menu: v })} />
    </div>
  );
}

export function RawaqFooterExtras({ settings, onChange }: SettingsProps) {
  const f = settings.footer;
  const set = (patch: Partial<RawaqSettings["footer"]>) => onChange({ ...settings, footer: { ...f, ...patch } });
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <SwitchRow title={r.footer.dark} checked={f.dark} onCheckedChange={(v) => set({ dark: v })} />
      <SwitchRow title={r.footer.payments} description={r.footer.paymentsHint} checked={f.payments} onCheckedChange={(v) => set({ payments: v })} />
    </div>
  );
}

export function RawaqGeneralExtras({ settings, onChange, errors }: SettingsProps) {
  const g = settings.general;
  const set = (patch: Partial<RawaqSettings["general"]>) => onChange({ ...settings, general: { ...g, ...patch } });
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <SwitchRow title={r.general.floatingCall} checked={g.floating_call} onCheckedChange={(v) => set({ floating_call: v })} />
      {g.floating_call ? (
        <Field label={r.general.callPhone} htmlFor="rq-call" hint={r.general.callHint(settings.footer.phone)} error={errors["general.call_phone"]} optional>
          <Input id="rq-call" dir="ltr" maxLength={30} placeholder="01xxxxxxxxx" value={g.call_phone ?? ""} onChange={(e) => set({ call_phone: e.target.value.trim() === "" ? null : e.target.value })} />
        </Field>
      ) : null}
      <SwitchRow title={r.general.animations} description={r.general.animationsHint} checked={g.animations} onCheckedChange={(v) => set({ animations: v })} />
    </div>
  );
}

/** Settings saved before the group existed come without it: its defaults fill it. */
const cardOf = (settings: RawaqSettings): RawaqCardSettings => ({ ...RAWAQ_CARD_DEFAULTS, ...settings.product_card });

export function RawaqCardForm({ settings, onChange, errors }: SettingsProps) {
  const card = cardOf(settings);
  const set = (patch: Partial<RawaqCardSettings>) => onChange({ ...settings, product_card: { ...card, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <Field label={r.card.image}>
        <Segmented value={card.image} onChange={(v) => set({ image: v })} options={(["square", "tall"] as const).map((k) => ({ value: k, label: r.card.images[k] }))} />
      </Field>
      <SwitchRow title={r.card.tinted} description={r.card.tintedHint} checked={card.tinted} onCheckedChange={(v) => set({ tinted: v })} />
      <SwitchRow title={r.card.rating} checked={card.show_rating} onCheckedChange={(v) => set({ show_rating: v })} />
      <SwitchRow title={r.card.description} checked={card.show_description} onCheckedChange={(v) => set({ show_description: v })} />
      <Field label={r.card.button}>
        <Segmented value={card.button} onChange={(v) => set({ button: v })} options={(["full", "icon"] as const).map((k) => ({ value: k, label: r.card.buttons[k] }))} />
      </Field>
      <Field label={r.card.radius} hint={r.card.radiusHint(card.radius)} error={errors["product_card.radius"]}>
        <input type="range" min={0} max={40} step={2} value={card.radius} onChange={(e) => set({ radius: Number(e.target.value) })} className="w-full accent-(--brand)" aria-label={r.card.radius} />
      </Field>
    </div>
  );
}

/* ---------- «صفحة المنتج»، «صفحات الأقسام»، «السلة» ---------- */

const rp = r.page;
const rl = r.listing;
const rc = r.cart;

/** Settings saved before the group existed come without it: its defaults fill it. */
const pageOf = (settings: RawaqSettings): RawaqPageSettings => ({ ...RAWAQ_PAGE_DEFAULTS, ...settings.product_page, viewers: { ...RAWAQ_PAGE_DEFAULTS.viewers, ...settings.product_page?.viewers } });

export function RawaqPageForm({ settings, onChange, errors }: SettingsProps) {
  const page = pageOf(settings);
  const set = (patch: Partial<RawaqPageSettings>) => onChange({ ...settings, product_page: { ...page, ...patch } });
  const setViewers = (patch: Partial<RawaqPageSettings["viewers"]>) => set({ viewers: { ...page.viewers, ...patch } });
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));
  return (
    <div className="flex flex-col gap-4">
      <Field label={rp.gallery}>
        <Segmented value={page.gallery} onChange={(v) => set({ gallery: v })} options={(["thumbs", "slider"] as const).map((k) => ({ value: k, label: rp.galleries[k] }))} />
      </Field>
      <SwitchRow title={rp.zoom} description={rp.zoomHint} checked={page.zoom} onCheckedChange={(v) => set({ zoom: v })} />
      <SwitchRow title={rp.description} checked={page.description} onCheckedChange={(v) => set({ description: v })} />
      <SwitchRow title={rp.reviews} checked={page.reviews} onCheckedChange={(v) => set({ reviews: v })} />
      <SwitchRow title={rp.whatsappAsk} description={rp.whatsappAskHint} checked={page.whatsapp_ask} onCheckedChange={(v) => set({ whatsapp_ask: v })} />

      <Field label={rp.promises} hint={rp.promisesHint} error={errors["product_page.promises"]} optional>
        <div className="flex flex-col gap-2">
          {page.promises.map((promise, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={rp.promise(i + 1)} maxLength={40} value={promise} onChange={(e) => set({ promises: page.promises.map((x, j) => (j === i ? e.target.value : x)) })} aria-invalid={errors[`product_page.promises.${i}`] ? true : undefined} />
              <Button size="sm" variant="ghost" onClick={() => set({ promises: page.promises.filter((_, j) => j !== i) })}>
                {sf.remove}
              </Button>
            </div>
          ))}
          {page.promises.length < 4 ? (
            <Button variant="outline" onClick={() => set({ promises: [...page.promises, ""] })}>
              <Plus />
              {rp.addPromise}
            </Button>
          ) : null}
        </div>
      </Field>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <SwitchRow title={rp.related} checked={page.related_enabled} onCheckedChange={(v) => set({ related_enabled: v })} />
        {page.related_enabled ? (
          <Field label={rp.relatedSource} hint={rp.relatedHint}>
            <Segmented value={page.related} onChange={(v) => set({ related: v })} options={(["similar", "category"] as const).map((k) => ({ value: k, label: rp.relatedSources[k] }))} />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <SwitchRow title={rp.sticky} description={rp.stickyHint} checked={page.sticky_bar} onCheckedChange={(v) => set({ sticky_bar: v })} />
        {page.sticky_bar ? (
          <Field label={rp.stickyButtons} hint={page.sticky_buttons !== "buy" ? rp.stickyCartHint : undefined}>
            <Select aria-label={rp.stickyButtons} value={page.sticky_buttons} onValueChange={(v) => set({ sticky_buttons: v as RawaqPageSettings["sticky_buttons"] })} options={(["cart", "both", "buy"] as const).map((k) => ({ value: k, label: rp.stickyChoices[k] }))} searchable={false} />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <SwitchRow title={rp.viewers} description={rp.viewersHint} checked={page.viewers.enabled} onCheckedChange={(v) => setViewers({ enabled: v })} />
        {page.viewers.enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label={rp.viewersMin} htmlFor="rq-v-min" error={errors["product_page.viewers.min"]}>
                <Input id="rq-v-min" type="number" dir="ltr" min={1} max={999000} value={page.viewers.min} onChange={(e) => setViewers({ min: num(e.target.value, 1, 999000) })} />
              </Field>
              <Field label={rp.viewersMax} htmlFor="rq-v-max" error={errors["product_page.viewers.max"]}>
                <Input id="rq-v-max" type="number" dir="ltr" min={1} max={999000} value={page.viewers.max} onChange={(e) => setViewers({ max: num(e.target.value, 1, 999000) })} />
              </Field>
            </div>
            <p className="text-xs text-ink-3">{rp.viewersRange}</p>
            <Field label={rp.viewersEvery} htmlFor="rq-v-every" error={errors["product_page.viewers.every"]}>
              <Input id="rq-v-every" type="number" dir="ltr" min={3} max={300} value={page.viewers.every} onChange={(e) => setViewers({ every: num(e.target.value, 3, 300) })} />
            </Field>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function RawaqListingForm({ settings, onChange }: SettingsProps) {
  const listing: RawaqListingSettings = { ...RAWAQ_LISTING_DEFAULTS, ...settings.listing };
  const set = (patch: Partial<RawaqListingSettings>) => onChange({ ...settings, listing: { ...listing, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <Field label={rl.columnsDesktop}>
        <Segmented value={String(listing.columns_desktop)} onChange={(v) => set({ columns_desktop: Number(v) })} options={["2", "3", "4", "5"].map((k) => ({ value: k, label: k }))} />
      </Field>
      <Field label={rl.columnsMobile}>
        <Segmented value={String(listing.columns_mobile)} onChange={(v) => set({ columns_mobile: Number(v) })} options={["1", "2"].map((k) => ({ value: k, label: k }))} />
      </Field>
      <SwitchRow title={rl.banner} description={rl.bannerHint} checked={listing.banner} onCheckedChange={(v) => set({ banner: v })} />
      <Field label={rl.subcategories}>
        <Segmented value={listing.subcategories} onChange={(v) => set({ subcategories: v })} options={(["circles", "chips"] as const).map((k) => ({ value: k, label: rl.subcategoryLooks[k] }))} />
      </Field>
      <Field label={rl.filters}>
        <Segmented value={listing.filters} onChange={(v) => set({ filters: v })} options={(["open", "button", "hidden"] as const).map((k) => ({ value: k, label: rl.filterLooks[k] }))} />
      </Field>
    </div>
  );
}

export function RawaqCartForm({ settings, onChange }: SettingsProps) {
  const cart: RawaqCartSettings = { ...RAWAQ_CART_DEFAULTS, ...settings.cart };
  const set = (patch: Partial<RawaqCartSettings>) => onChange({ ...settings, cart: { ...cart, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow title={rc.freeShipping} description={rc.freeShippingHint} checked={cart.free_shipping_bar} onCheckedChange={(v) => set({ free_shipping_bar: v })} />
      <SwitchRow title={rc.suggestions} checked={cart.suggestions_enabled} onCheckedChange={(v) => set({ suggestions_enabled: v })} />
      {cart.suggestions_enabled ? (
        <Field label={rc.suggestions}>
          <Segmented value={cart.suggestions} onChange={(v) => set({ suggestions: v })} options={(["offers", "latest"] as const).map((k) => ({ value: k, label: rc.suggestionSources[k] }))} />
        </Field>
      ) : null}
      <SwitchRow title={rc.notes} description={rc.notesHint} checked={cart.order_notes} onCheckedChange={(v) => set({ order_notes: v })} />
    </div>
  );
}


/* ---------- before / after, the skin quiz, care tips ---------- */

export function BeforeAfterForm({ props, onChange, errors, media, onMedia }: Props<BeforeAfterProps> & Media) {
  const set = (patch: Partial<BeforeAfterProps>) => onChange({ ...props, ...patch });
  const setFact = (i: number, patch: Partial<BeforeAfterProps["facts"][number]>) => set({ facts: props.facts.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="ba-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="ba-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      <Text id="ba-text" label={sf.text} value={props.text} onChange={(v) => set({ text: v })} error={errors.text} max={300} area />
      <p className="text-xs text-ink-3">{r.beforeAfter.hint}</p>
      <ImagePick id={props.before_media_id} onChange={(id) => set({ before_media_id: id })} media={media} onMedia={onMedia} error={errors.before_media_id} label={r.beforeAfter.before} />
      <Text id="ba-before" label={r.beforeAfter.beforeLabel} value={props.before_label} onChange={(v) => set({ before_label: v ?? "" })} error={errors.before_label} max={20} required />
      <ImagePick id={props.after_media_id} onChange={(id) => set({ after_media_id: id })} media={media} onMedia={onMedia} error={errors.after_media_id} label={r.beforeAfter.after} />
      <Text id="ba-after" label={r.beforeAfter.afterLabel} value={props.after_label} onChange={(v) => set({ after_label: v ?? "" })} error={errors.after_label} max={20} required />
      <Field label={r.beforeAfter.facts} error={errors.facts}>
        <div className="flex flex-col gap-3">
          {props.facts.map((fact, i) => (
            <Card key={i} title={r.beforeAfter.fact(i + 1)} onRemove={() => set({ facts: props.facts.filter((_, j) => j !== i) })} removeLabel={sf.remove}>
              <Text id={`ba-${i}-value`} label={r.beforeAfter.value} value={fact.value} onChange={(v) => setFact(i, { value: v ?? "" })} error={errors[`facts.${i}.value`]} max={12} required />
              <Text id={`ba-${i}-label`} label={r.beforeAfter.label} value={fact.label} onChange={(v) => setFact(i, { label: v ?? "" })} error={errors[`facts.${i}.label`]} max={40} required />
            </Card>
          ))}
          {props.facts.length < 3 ? (
            <Button variant="outline" onClick={() => set({ facts: [...props.facts, { value: "", label: "" }] })}>
              <Plus />
              {r.beforeAfter.addFact}
            </Button>
          ) : null}
        </div>
      </Field>
    </div>
  );
}

/** A short id for a new result (letters and digits, unique in this quiz). */
function resultId(taken: string[]): string {
  for (;;) {
    const id = `r${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.includes(id)) return id;
  }
}

function QuizNumbers({ sectionId }: { sectionId: string }) {
  const stats = useQuizResults();
  if (!stats.isSuccess) return null;
  const mine = stats.data.find((s) => s.section_id === sectionId);
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-surface-2 p-3 text-sm">
      <b>{r.quiz.stats}</b>
      {!mine || mine.total === 0 ? (
        <p className="text-ink-3">{r.quiz.statsNone}</p>
      ) : (
        <>
          <p className="text-ink-2">{r.quiz.statsTotal(mine.total)}</p>
          <ul className="flex flex-col gap-1">
            {mine.results.map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                <span className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, (x.count / mine.total) * 60)}%` }} aria-hidden />
                <span className="shrink-0 text-ink-2">{r.quiz.statsRow(x.name, x.count)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function SkinQuizForm({ sectionId, props, onChange, errors }: Props<SkinQuizProps> & { sectionId: string }) {
  const products = useProductChoices();
  const categories = useCategories();
  const productOptions = (products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }));
  const categoryOptions = [{ value: "", label: r.quiz.noCategory }, ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))];
  const set = (patch: Partial<SkinQuizProps>) => onChange({ ...props, ...patch });
  const setResult = (i: number, patch: Partial<QuizResult>) => set({ results: props.results.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setQuestion = (i: number, patch: Partial<QuizQuestion>) => set({ questions: props.questions.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setAnswer = (q: number, a: number, patch: Partial<QuizAnswer>) => setQuestion(q, { answers: props.questions[q]!.answers.map((x, j) => (j === a ? { ...x, ...patch } : x)) });
  const resultOptions = props.results.map((x, i) => ({ value: x.id, label: x.name || r.quiz.result(i + 1) }));
  // Removing a result takes it off every answer too.
  const removeResult = (i: number) => {
    const gone = props.results[i]!.id;
    set({
      results: props.results.filter((_, j) => j !== i),
      questions: props.questions.map((q) => ({ ...q, answers: q.answers.map((a) => ({ ...a, results: a.results.filter((id) => id !== gone) })) })),
    });
  };
  return (
    <div className="flex flex-col gap-4">
      <QuizNumbers sectionId={sectionId} />
      <Text id="qz-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="qz-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} error={errors.title} max={80} required />
      <Text id="qz-text" label={sf.text} value={props.text} onChange={(v) => set({ text: v })} error={errors.text} max={300} area />
      <Text id="qz-button" label={sf.buttonLabel} hint={r.quiz.buttonHint} value={props.button_label} onChange={(v) => set({ button_label: v })} error={errors.button_label} max={30} />
      <p className="text-xs text-ink-3">{r.quiz.howItWorks}</p>

      <Field label={r.quiz.results} hint={r.quiz.resultsHint} error={errors.results} required>
        <div className="flex flex-col gap-3">
          {props.results.map((result, i) => (
            <Card
              key={result.id}
              title={r.quiz.result(i + 1)}
              onUp={i > 0 ? () => set({ results: move(props.results, i, i - 1) }) : undefined}
              onDown={i < props.results.length - 1 ? () => set({ results: move(props.results, i, i + 1) }) : undefined}
              onRemove={props.results.length > 2 ? () => removeResult(i) : undefined}
              removeLabel={sf.remove}
            >
              <Text id={`qz-r${i}-name`} label={r.quiz.resultName} value={result.name} onChange={(v) => setResult(i, { name: v ?? "" })} error={errors[`results.${i}.name`] ?? errors[`results.${i}.id`]} max={40} required />
              <Text id={`qz-r${i}-text`} label={r.quiz.resultText} value={result.text} onChange={(v) => setResult(i, { text: v })} error={errors[`results.${i}.text`]} max={300} area />
              <Field label={r.quiz.products} error={errors[`results.${i}.product_ids`]}>
                <MultiSelect value={result.product_ids.map(String)} onChange={(v) => setResult(i, { product_ids: v.slice(-4).map(Number) })} options={productOptions} placeholder={r.quiz.products} />
              </Field>
              <Field label={r.quiz.category} error={errors[`results.${i}.category_id`]}>
                <Select aria-label={r.quiz.category} value={result.category_id ? String(result.category_id) : ""} onValueChange={(v) => setResult(i, { category_id: v ? Number(v) : null })} options={categoryOptions} />
              </Field>
            </Card>
          ))}
          {props.results.length < 6 ? (
            <Button variant="outline" onClick={() => set({ results: [...props.results, { id: resultId(props.results.map((x) => x.id)), name: "", text: null, product_ids: [], category_id: null }] })}>
              <Plus />
              {r.quiz.addResult}
            </Button>
          ) : null}
        </div>
      </Field>

      <Field label={r.quiz.questions} error={errors.questions} required>
        <div className="flex flex-col gap-3">
          {props.questions.map((question, q) => (
            <Card
              key={q}
              title={r.quiz.question(q + 1)}
              onUp={q > 0 ? () => set({ questions: move(props.questions, q, q - 1) }) : undefined}
              onDown={q < props.questions.length - 1 ? () => set({ questions: move(props.questions, q, q + 1) }) : undefined}
              onRemove={props.questions.length > 2 ? () => set({ questions: props.questions.filter((_, j) => j !== q) }) : undefined}
              removeLabel={sf.remove}
            >
              <Text id={`qz-q${q}`} label={r.quiz.questionText} value={question.text} onChange={(v) => setQuestion(q, { text: v ?? "" })} error={errors[`questions.${q}.text`]} max={120} required />
              {errors[`questions.${q}.answers`] ? <p className="text-sm text-danger">{errors[`questions.${q}.answers`]}</p> : null}
              {question.answers.map((answer, a) => (
                <div key={a} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Text id={`qz-q${q}-a${a}`} label={r.quiz.answer(a + 1)} value={answer.text} onChange={(v) => setAnswer(q, a, { text: v ?? "" })} error={errors[`questions.${q}.answers.${a}.text`]} max={60} required />
                    </div>
                    {question.answers.length > 2 ? (
                      <Button variant="ghost" size="sm" onClick={() => setQuestion(q, { answers: question.answers.filter((_, j) => j !== a) })}>
                        {sf.remove}
                      </Button>
                    ) : null}
                  </div>
                  <Field label={r.quiz.answerResults} hint={r.quiz.answerResultsHint} error={errors[`questions.${q}.answers.${a}.results`] ?? errors[`questions.${q}.answers.${a}.results.0`] ?? errors[`questions.${q}.answers.${a}.results.1`]} required>
                    <MultiSelect value={answer.results} onChange={(v) => setAnswer(q, a, { results: v.slice(-2) })} options={resultOptions} placeholder={r.quiz.answerResults} />
                  </Field>
                </div>
              ))}
              {question.answers.length < 5 ? (
                <Button variant="outline" size="sm" onClick={() => setQuestion(q, { answers: [...question.answers, { text: "", results: [] }] })}>
                  <Plus />
                  {r.quiz.addAnswer}
                </Button>
              ) : null}
            </Card>
          ))}
          {props.questions.length < 6 ? (
            <Button variant="outline" onClick={() => set({ questions: [...props.questions, { text: "", answers: [{ text: "", results: [] }, { text: "", results: [] }] }] })}>
              <Plus />
              {r.quiz.addQuestion}
            </Button>
          ) : null}
        </div>
      </Field>
    </div>
  );
}

export function ArticlesForm({ props, onChange, errors, media, onMedia }: Props<ArticlesProps> & Media) {
  const set = (patch: Partial<ArticlesProps>) => onChange({ ...props, ...patch });
  const setItem = (i: number, patch: Partial<Article>) => set({ items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="ar-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="ar-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      {errors.items ? <p className="text-sm text-danger">{errors.items}</p> : null}
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={r.articles.item(i + 1)}
          onUp={i > 0 ? () => set({ items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => set({ items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 1 ? () => set({ items: props.items.filter((_, j) => j !== i) }) : undefined}
          removeLabel={sf.remove}
        >
          <Text id={`ar-${i}-tag`} label={r.articles.tag} hint={r.articles.tagHint} value={item.tag} onChange={(v) => setItem(i, { tag: v })} error={errors[`items.${i}.tag`]} max={30} />
          <Text id={`ar-${i}-title`} label={r.articles.title} value={item.title} onChange={(v) => setItem(i, { title: v ?? "" })} error={errors[`items.${i}.title`]} max={80} required />
          <Text id={`ar-${i}-body`} label={r.articles.body} hint={r.articles.bodyHint} value={item.body} onChange={(v) => setItem(i, { body: v })} error={errors[`items.${i}.body`]} max={3000} area />
          <LinkField value={item.link} onChange={(link) => setItem(i, { link })} errors={errors} prefix={`items.${i}.link`} />
          <ImagePick id={item.media_id} onChange={(id) => setItem(i, { media_id: id })} media={media} onMedia={onMedia} error={errors[`items.${i}.media_id`]} label={r.articles.image} optional />
        </Card>
      ))}
      {props.items.length < 6 ? (
        <Button variant="outline" onClick={() => set({ items: [...props.items, { media_id: null, tag: null, title: "", body: null, link: NONE }] })}>
          <Plus />
          {r.articles.add}
        </Button>
      ) : null}
    </div>
  );
}
