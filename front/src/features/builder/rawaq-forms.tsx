"use client";

import { Plus } from "lucide-react";
import { ColorInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { useProductChoices } from "@/features/promotions/api";
import { ar } from "@/messages/ar";
import type { Link } from "@/themes/store/sufi/types";
import { RAWAQ_CARD_DEFAULTS, type CtaProps, type GlowHeroProps, type Ingredient, type IngredientsProps, type RawaqCardSettings, type RawaqSettings, type Reel, type ReelsProps, type RoutineProps, type RoutineStep, type Shortcut, type ShortcutsProps } from "@/themes/store/rawaq/types";
import { ImagePick, LinkField, Text, type Errors, type Media } from "./library-forms";
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
