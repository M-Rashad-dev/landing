"use client";

import { Plus } from "lucide-react";
import { ColorInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { useOffers } from "@/features/promotions/api";
import { ar } from "@/messages/ar";
import { FOOD_ICON_KEYS } from "@/themes/store/shabe/root";
import { CARD_DEFAULTS, CART_DEFAULTS, LISTING_DEFAULTS, PAGE_DEFAULTS, type BundleCard, type BundlesProps, type CardSettings, type CartSettings, type FoodHeroProps, type FoodIcon, type HoursProps, type ListingSettings, type PageSettings, type ShabeStoreSettings, type StepsProps, type WhyProps } from "@/themes/store/shabe/types";
import { ImagePick, LinkField, Text, type Errors, type Media } from "./library-forms";
import { Card, move } from "./section-forms";

const s = ar.design.shabeStore;
const sf = ar.design.sufi;

type Props<P> = { props: P; onChange: (p: P) => void; errors: Errors };

function IconSelect({ value, onChange }: { value: FoodIcon; onChange: (v: FoodIcon) => void }) {
  return <Select aria-label={s.items.icon} value={value} onValueChange={(v) => onChange(v as FoodIcon)} options={FOOD_ICON_KEYS.map((k) => ({ value: k, label: k }))} searchable={false} />;
}

/* ---------- sections ---------- */

export function FoodHeroForm({ props, onChange, errors, media, onMedia }: Props<FoodHeroProps> & Media) {
  const set = (patch: Partial<FoodHeroProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="fh-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="fh-title" label={s.hero.title} value={props.title} onChange={(v) => set({ title: v ?? "" })} error={errors.title} max={100} required />
      <Text id="fh-highlight" label={s.hero.highlight} hint={s.hero.highlightHint} value={props.highlight} onChange={(v) => set({ highlight: v })} error={errors.highlight} max={40} />
      <Text id="fh-subtitle" label={s.hero.subtitle} value={props.subtitle} onChange={(v) => set({ subtitle: v })} error={errors.subtitle} max={300} area />
      <ImagePick id={props.media_id} onChange={(id) => set({ media_id: id })} media={media} onMedia={onMedia} error={errors.media_id} optional />
      <Field label={s.hero.stickers} optional>
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Input
              key={i}
              aria-label={s.hero.sticker(i + 1)}
              maxLength={30}
              value={props.stickers[i] ?? ""}
              onChange={(e) => {
                const next = [props.stickers[0] ?? "", props.stickers[1] ?? ""];
                next[i] = e.target.value;
                set({ stickers: next.filter((x) => x.trim() !== "") });
              }}
            />
          ))}
        </div>
      </Field>
      <Text id="fh-badge" label={s.hero.badge} hint={s.hero.badgeHint} value={props.badge} onChange={(v) => set({ badge: v })} error={errors.badge} max={20} />
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <Text id="fh-primary" label={s.hero.primary} value={props.primary_label} onChange={(v) => set({ primary_label: v ?? "" })} error={errors.primary_label} max={30} required />
        <LinkField value={props.primary_link} onChange={(link) => set({ primary_link: link })} errors={errors} prefix="primary_link" />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <Text id="fh-second" label={s.hero.second} value={props.second_label} onChange={(v) => set({ second_label: v })} error={errors.second_label} max={30} />
        {props.second_label ? <LinkField value={props.second_link} onChange={(link) => set({ second_link: link })} errors={errors} prefix="second_link" /> : null}
      </div>
      <Field label={s.hero.trust} optional>
        <div className="flex flex-col gap-2">
          {props.trust.map((item, i) => (
            <Card key={i} title={s.hero.trustItem(i + 1)} onRemove={() => set({ trust: props.trust.filter((_, j) => j !== i) })} removeLabel={sf.remove}>
              <IconSelect value={item.icon} onChange={(icon) => set({ trust: props.trust.map((x, j) => (j === i ? { ...x, icon } : x)) })} />
              <Input aria-label={s.hero.trustItem(i + 1)} maxLength={40} value={item.text} onChange={(e) => set({ trust: props.trust.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            </Card>
          ))}
          {props.trust.length < 4 ? (
            <Button variant="outline" onClick={() => set({ trust: [...props.trust, { icon: "bike", text: "" }] })}>
              <Plus />
              {s.hero.addTrust}
            </Button>
          ) : null}
        </div>
      </Field>
    </div>
  );
}

/** «ليه إحنا» and «خطوات الطلب»: a head and a list of {icon, title, text}. */
function IconItems<P extends WhyProps | StepsProps>({ props, onChange, errors, min, max }: Props<P> & { min: number; max: number }) {
  const set = (patch: Partial<P>) => onChange({ ...props, ...patch });
  const items = props.items;
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <Card
          key={i}
          title={s.items.item(i + 1)}
          onUp={i > 0 ? () => set({ items: move(items, i, i - 1) } as Partial<P>) : undefined}
          onDown={i < items.length - 1 ? () => set({ items: move(items, i, i + 1) } as Partial<P>) : undefined}
          onRemove={items.length > min ? () => set({ items: items.filter((_, j) => j !== i) } as Partial<P>) : undefined}
          removeLabel={sf.remove}
        >
          <IconSelect value={item.icon} onChange={(icon) => set({ items: items.map((x, j) => (j === i ? { ...x, icon } : x)) } as Partial<P>)} />
          <Text id={`it-${i}-title`} label={sf.title} value={item.title} onChange={(v) => set({ items: items.map((x, j) => (j === i ? { ...x, title: v ?? "" } : x)) } as Partial<P>)} error={errors[`items.${i}.title`]} max={40} required />
          <Text id={`it-${i}-text`} label={sf.text} value={item.text} onChange={(v) => set({ items: items.map((x, j) => (j === i ? { ...x, text: v } : x)) } as Partial<P>)} error={errors[`items.${i}.text`]} max={160} />
        </Card>
      ))}
      {items.length < max ? (
        <Button variant="outline" onClick={() => set({ items: [...items, { icon: "star", title: "", text: null }] } as Partial<P>)}>
          <Plus />
          {s.items.add}
        </Button>
      ) : null}
    </div>
  );
}

export function WhyForm({ props, onChange, errors, media, onMedia }: Props<WhyProps> & Media) {
  const set = (patch: Partial<WhyProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="why-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="why-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      <Text id="why-subtitle" label={sf.description} value={props.subtitle} onChange={(v) => set({ subtitle: v })} error={errors.subtitle} max={200} />
      <ImagePick id={props.media_id} onChange={(id) => set({ media_id: id })} media={media} onMedia={onMedia} error={errors.media_id} optional />
      <Text id="why-quote" label={s.items.quote} value={props.quote} onChange={(v) => set({ quote: v })} error={errors.quote} max={200} />
      <IconItems props={props} onChange={onChange} errors={errors} min={2} max={6} />
    </div>
  );
}

export function StepsForm({ props, onChange, errors }: Props<StepsProps>) {
  const set = (patch: Partial<StepsProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Text id="st-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="st-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      <IconItems props={props} onChange={onChange} errors={errors} min={2} max={5} />
    </div>
  );
}

export function BundlesForm({ props, onChange, errors, media, onMedia }: Props<BundlesProps> & Media) {
  const offers = useOffers({ q: "", status: "all", page: 1 });
  const options = (offers.data?.data ?? []).map((o) => ({ value: String(o.id), label: o.name }));
  const set = (patch: Partial<BundlesProps>) => onChange({ ...props, ...patch });
  const setCard = (i: number, patch: Partial<BundleCard>) => set({ cards: props.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="bd-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={40} />
      <Text id="bd-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      <Text id="bd-subtitle" label={sf.description} value={props.subtitle} onChange={(v) => set({ subtitle: v })} error={errors.subtitle} max={200} />
      {offers.isSuccess && options.length === 0 ? <p className="text-sm text-warning">{s.bundles.noOffers}</p> : null}
      {props.cards.map((card, i) => (
        <Card key={i} title={s.bundles.card(i + 1)} onUp={i > 0 ? () => set({ cards: move(props.cards, i, i - 1) }) : undefined} onDown={i < props.cards.length - 1 ? () => set({ cards: move(props.cards, i, i + 1) }) : undefined} onRemove={props.cards.length > 1 ? () => set({ cards: props.cards.filter((_, j) => j !== i) }) : undefined} removeLabel={sf.remove}>
          <Field label={s.bundles.offer} hint={s.bundles.offerHint} error={errors[`cards.${i}.offer_id`]} required>
            <Select aria-label={s.bundles.offer} value={card.offer_id ? String(card.offer_id) : ""} onValueChange={(v) => setCard(i, { offer_id: Number(v) })} options={options} placeholder={s.bundles.offer} />
          </Field>
          <Text id={`bd-${i}-title`} label={sf.title} value={card.title} onChange={(v) => setCard(i, { title: v ?? "" })} error={errors[`cards.${i}.title`]} max={60} required />
          <Text id={`bd-${i}-subtitle`} label={sf.description} value={card.subtitle} onChange={(v) => setCard(i, { subtitle: v })} error={errors[`cards.${i}.subtitle`]} max={80} />
          <ImagePick id={card.media_id} onChange={(id) => setCard(i, { media_id: id })} media={media} onMedia={onMedia} error={errors[`cards.${i}.media_id`]} optional />
          <Field label={s.bundles.points} optional>
            <div className="flex flex-col gap-2">
              {card.points.map((point, j) => (
                <Input key={j} aria-label={s.bundles.point(j + 1)} maxLength={60} value={point} onChange={(e) => setCard(i, { points: card.points.map((x, k) => (k === j ? e.target.value : x)).filter((x, k) => k === j || x.trim() !== "") })} />
              ))}
              {card.points.length < 5 ? (
                <Button size="sm" variant="ghost" onClick={() => setCard(i, { points: [...card.points, ""] })}>
                  <Plus />
                  {s.bundles.addPoint}
                </Button>
              ) : null}
            </div>
          </Field>
          <Text id={`bd-${i}-ribbon`} label={s.bundles.ribbon} hint={s.bundles.ribbonHint} value={card.ribbon} onChange={(v) => setCard(i, { ribbon: v })} error={errors[`cards.${i}.ribbon`]} max={24} />
          <Text id={`bd-${i}-button`} label={sf.buttonLabel} value={card.button_label} onChange={(v) => setCard(i, { button_label: v })} error={errors[`cards.${i}.button_label`]} max={30} />
        </Card>
      ))}
      {props.cards.length < 4 ? (
        <Button variant="outline" onClick={() => set({ cards: [...props.cards, { offer_id: 0, media_id: null, title: "", subtitle: null, points: [], ribbon: null, button_label: null }] })}>
          <Plus />
          {s.bundles.add}
        </Button>
      ) : null}
    </div>
  );
}

export function HoursForm({ props, onChange, errors }: Props<HoursProps>) {
  const set = (patch: Partial<HoursProps>) => onChange({ ...props, ...patch });
  const setDay = (i: number, patch: Partial<HoursProps["days"][number]>) => set({ days: props.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="hr-title" label={sf.title} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={80} />
      <Text id="hr-subtitle" label={sf.description} value={props.subtitle} onChange={(v) => set({ subtitle: v })} error={errors.subtitle} max={200} />
      <p className="text-xs text-ink-3">{s.hours.cairoHint}</p>
      <ul className="flex flex-col gap-2">
        {props.days.map((day, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <SwitchRow title={s.hours.days[i]} description={day.open && day.to < day.from ? s.hours.overnight : undefined} checked={day.open} onCheckedChange={(v) => setDay(i, { open: v })} />
            {day.open ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label={s.hours.from} error={errors[`days.${i}.from`]}>
                  <Input type="time" dir="ltr" value={day.from} onChange={(e) => setDay(i, { from: e.target.value })} />
                </Field>
                <Field label={s.hours.to} error={errors[`days.${i}.to`]}>
                  <Input type="time" dir="ltr" value={day.to} onChange={(e) => setDay(i, { to: e.target.value })} />
                </Field>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={() => set({ days: props.days.map(() => ({ ...props.days[0] })) })}>
        {s.hours.sameAll}
      </Button>
      <Text id="hr-open" label={s.hours.openMessage} value={props.open_message} onChange={(v) => set({ open_message: v ?? "" })} error={errors.open_message} max={160} required area />
      <Text id="hr-closed" label={s.hours.closedMessage} value={props.closed_message} onChange={(v) => set({ closed_message: v ?? "" })} error={errors.closed_message} max={160} required area />
    </div>
  );
}

/* ---------- theme settings that only «شابع» has (under the base forms of each group) ---------- */

type SettingsProps = { settings: ShabeStoreSettings; onChange: (s: ShabeStoreSettings) => void; errors: Errors };
const st = s.settings;

/** Local "YYYY-MM-DDTHH:mm" for an <input type="datetime-local"> from a stored UTC time. */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ShabeLookExtras({ settings, onChange }: SettingsProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={st.dark} hint={st.darkHint}>
        <ColorInput id="ss-dark" value={settings.colors.dark} onChange={(v) => onChange({ ...settings, colors: { ...settings.colors, dark: v.toLowerCase() } })} />
      </Field>
      <SwitchRow title={st.display} description={st.displayHint} checked={settings.display_font} onCheckedChange={(v) => onChange({ ...settings, display_font: v })} />
      <Field label={st.button}>
        <Segmented value={settings.button} onChange={(v) => onChange({ ...settings, button: v })} options={(["rounded", "pill", "square"] as const).map((k) => ({ value: k, label: st.buttons[k] }))} />
      </Field>
    </div>
  );
}

export function ShabeHeaderExtras({ settings, onChange, errors }: SettingsProps) {
  const h = settings.header;
  const set = (patch: Partial<ShabeStoreSettings["header"]>) => onChange({ ...settings, header: { ...h, ...patch } });
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={st.layout}>
        <Segmented value={h.layout} onChange={(v) => set({ layout: v })} options={(["start", "center"] as const).map((k) => ({ value: k, label: st.layouts[k] }))} />
      </Field>
      <Field label={st.countdown} hint={st.countdownHint} error={errors["header.countdown_ends_at"]} optional>
        <Input type="datetime-local" dir="ltr" value={toLocal(h.countdown_ends_at)} onChange={(e) => set({ countdown_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
      </Field>
      <Field label={st.hotline} hint={st.hotlineHint} error={errors["header.hotline"]} optional>
        <Input dir="ltr" maxLength={30} placeholder="19xxx" value={h.hotline ?? ""} onChange={(e) => set({ hotline: e.target.value.trim() === "" ? null : e.target.value })} />
      </Field>
      <Text id="ss-hbtn" label={st.buttonLabel} hint={st.buttonHint} value={h.button_label} onChange={(v) => set({ button_label: v })} error={errors["header.button_label"]} max={30} />
      {h.button_label ? <LinkField value={h.button_link} onChange={(link) => set({ button_link: link })} errors={errors} prefix="header.button_link" /> : null}
      <SwitchRow title={st.categories} description={st.categoriesHint} checked={h.categories_menu} onCheckedChange={(v) => set({ categories_menu: v })} />
    </div>
  );
}

export function ShabeFooterExtras({ settings, onChange }: SettingsProps) {
  const f = settings.footer;
  const set = (patch: Partial<ShabeStoreSettings["footer"]>) => onChange({ ...settings, footer: { ...f, ...patch } });
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <SwitchRow title={st.footerDark} checked={f.dark} onCheckedChange={(v) => set({ dark: v })} />
      <SwitchRow title={st.payments} checked={f.payments} onCheckedChange={(v) => set({ payments: v })} />
    </div>
  );
}

export function ShabeGeneralExtras({ settings, onChange, errors }: SettingsProps) {
  const g = settings.general;
  const set = (patch: Partial<ShabeStoreSettings["general"]>) => onChange({ ...settings, general: { ...g, ...patch } });
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <SwitchRow title={st.floatingCall} checked={g.floating_call} onCheckedChange={(v) => set({ floating_call: v })} />
      {g.floating_call ? (
        <Field label={st.callPhone} htmlFor="ss-call" hint={st.callHint(settings.footer.phone)} error={errors["general.call_phone"]} optional>
          <Input id="ss-call" dir="ltr" maxLength={30} placeholder="01xxxxxxxxx" value={g.call_phone ?? ""} onChange={(e) => set({ call_phone: e.target.value.trim() === "" ? null : e.target.value })} />
        </Field>
      ) : null}
      <SwitchRow title={st.animations} description={st.animationsHint} checked={g.animations} onCheckedChange={(v) => set({ animations: v })} />
    </div>
  );
}

/* ---------- «كارد المنتج» and «صفحة المنتج» (only «شابع» has these groups) ---------- */

const sc = s.card;
const sp = s.page;

/** Settings saved before a group existed come without it: its defaults fill it. */
const cardOf = (settings: ShabeStoreSettings): CardSettings => ({ ...CARD_DEFAULTS, ...settings.product_card });
const pageOf = (settings: ShabeStoreSettings): PageSettings => ({ ...PAGE_DEFAULTS, ...settings.product_page, viewers: { ...PAGE_DEFAULTS.viewers, ...settings.product_page?.viewers } });

export function ShabeCardForm({ settings, onChange, errors }: SettingsProps) {
  const card = cardOf(settings);
  const set = (patch: Partial<CardSettings>) => onChange({ ...settings, product_card: { ...card, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <Field label={sc.image}>
        <Segmented value={card.image} onChange={(v) => set({ image: v })} options={(["square", "wide", "circle"] as const).map((k) => ({ value: k, label: sc.images[k] }))} />
      </Field>
      <SwitchRow title={sc.description} checked={card.show_description} onCheckedChange={(v) => set({ show_description: v })} />
      <SwitchRow title={sc.rating} checked={card.show_rating} onCheckedChange={(v) => set({ show_rating: v })} />
      <Field label={sc.button}>
        <Segmented value={card.button} onChange={(v) => set({ button: v })} options={(["icon", "full"] as const).map((k) => ({ value: k, label: sc.buttons[k] }))} />
      </Field>
      <Field label={sc.borderWidth} hint={card.border_width === 0 ? sc.borderNone : sc.borderPx(card.border_width)} error={errors["product_card.border_width"]}>
        <input type="range" min={0} max={6} step={1} value={card.border_width} onChange={(e) => set({ border_width: Number(e.target.value) })} className="w-full accent-(--brand)" aria-label={sc.borderWidth} />
      </Field>
      {card.border_width > 0 ? (
        <Field label={sc.borderColor} hint={sc.borderColorHint} error={errors["product_card.border_color"]}>
          <div className="flex items-center gap-2">
            <Segmented
              value={card.border_color === null ? "theme" : "own"}
              onChange={(v) => set({ border_color: v === "theme" ? null : (card.border_color ?? settings.colors.primary) })}
              options={[
                { value: "theme", label: sc.borderTheme },
                { value: "own", label: sc.borderColor },
              ]}
            />
            {card.border_color !== null ? <ColorInput id="ss-card-border" value={card.border_color} onChange={(v) => set({ border_color: v.toLowerCase() })} /> : null}
          </div>
        </Field>
      ) : null}
      <Field label={sc.radius} hint={sc.radiusHint(card.radius)} error={errors["product_card.radius"]}>
        <input type="range" min={0} max={40} step={2} value={card.radius} onChange={(e) => set({ radius: Number(e.target.value) })} className="w-full accent-(--brand)" aria-label={sc.radius} />
      </Field>
      <SwitchRow title={sc.shadow} checked={card.shadow} onCheckedChange={(v) => set({ shadow: v })} />
    </div>
  );
}

export function ShabePageForm({ settings, onChange, errors }: SettingsProps) {
  const page = pageOf(settings);
  const set = (patch: Partial<PageSettings>) => onChange({ ...settings, product_page: { ...page, ...patch } });
  const setViewers = (patch: Partial<PageSettings["viewers"]>) => set({ viewers: { ...page.viewers, ...patch } });
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));
  return (
    <div className="flex flex-col gap-4">
      <Field label={sp.gallery}>
        <Segmented value={page.gallery} onChange={(v) => set({ gallery: v })} options={(["thumbs", "slider"] as const).map((k) => ({ value: k, label: sp.galleries[k] }))} />
      </Field>
      <SwitchRow title={sp.zoom} description={sp.zoomHint} checked={page.zoom} onCheckedChange={(v) => set({ zoom: v })} />
      <SwitchRow title={sp.description} checked={page.description} onCheckedChange={(v) => set({ description: v })} />
      <SwitchRow title={sp.reviews} checked={page.reviews} onCheckedChange={(v) => set({ reviews: v })} />
      <SwitchRow title={sp.whatsappAsk} description={sp.whatsappAskHint} checked={page.whatsapp_ask} onCheckedChange={(v) => set({ whatsapp_ask: v })} />

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <SwitchRow title={sp.related} checked={page.related_enabled} onCheckedChange={(v) => set({ related_enabled: v })} />
        {page.related_enabled ? (
          <Field label={sp.relatedSource} hint={sp.relatedHint}>
            <Segmented value={page.related} onChange={(v) => set({ related: v })} options={(["category", "similar"] as const).map((k) => ({ value: k, label: sp.relatedSources[k] }))} />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <SwitchRow title={sp.sticky} description={sp.stickyHint} checked={page.sticky_bar} onCheckedChange={(v) => set({ sticky_bar: v })} />
        {page.sticky_bar ? (
          <Field label={sp.stickyButtons} hint={page.sticky_buttons !== "buy" ? sp.stickyCartHint : undefined}>
            <Select aria-label={sp.stickyButtons} value={page.sticky_buttons} onValueChange={(v) => set({ sticky_buttons: v as PageSettings["sticky_buttons"] })} options={(["cart", "both", "buy"] as const).map((k) => ({ value: k, label: sp.stickyChoices[k] }))} searchable={false} />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <SwitchRow title={sp.viewers} description={sp.viewersHint} checked={page.viewers.enabled} onCheckedChange={(v) => setViewers({ enabled: v })} />
        {page.viewers.enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label={sp.viewersMin} htmlFor="ss-v-min" error={errors["product_page.viewers.min"]}>
                <Input id="ss-v-min" type="number" dir="ltr" min={1} max={999000} value={page.viewers.min} onChange={(e) => setViewers({ min: num(e.target.value, 1, 999000) })} />
              </Field>
              <Field label={sp.viewersMax} htmlFor="ss-v-max" error={errors["product_page.viewers.max"]}>
                <Input id="ss-v-max" type="number" dir="ltr" min={1} max={999000} value={page.viewers.max} onChange={(e) => setViewers({ max: num(e.target.value, 1, 999000) })} />
              </Field>
            </div>
            <p className="text-xs text-ink-3">{sp.viewersRange}</p>
            <Field label={sp.viewersEvery} htmlFor="ss-v-every" error={errors["product_page.viewers.every"]}>
              <Input id="ss-v-every" type="number" dir="ltr" min={3} max={300} value={page.viewers.every} onChange={(e) => setViewers({ every: num(e.target.value, 3, 300) })} />
            </Field>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- «صفحات الأقسام» and «السلة» ---------- */

const sl = s.listing;
const sct = s.cart;

export function ShabeListingForm({ settings, onChange }: SettingsProps) {
  const listing: ListingSettings = { ...LISTING_DEFAULTS, ...settings.listing };
  const set = (patch: Partial<ListingSettings>) => onChange({ ...settings, listing: { ...listing, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <Field label={sl.columnsDesktop}>
        <Segmented value={String(listing.columns_desktop)} onChange={(v) => set({ columns_desktop: Number(v) })} options={["2", "3", "4", "5"].map((k) => ({ value: k, label: k }))} />
      </Field>
      <Field label={sl.columnsMobile}>
        <Segmented value={String(listing.columns_mobile)} onChange={(v) => set({ columns_mobile: Number(v) })} options={["1", "2"].map((k) => ({ value: k, label: k }))} />
      </Field>
      <SwitchRow title={sl.banner} description={sl.bannerHint} checked={listing.banner} onCheckedChange={(v) => set({ banner: v })} />
      <Field label={sl.subcategories}>
        <Segmented value={listing.subcategories} onChange={(v) => set({ subcategories: v })} options={(["circles", "chips"] as const).map((k) => ({ value: k, label: sl.subcategoryLooks[k] }))} />
      </Field>
      <Field label={sl.filters}>
        <Segmented value={listing.filters} onChange={(v) => set({ filters: v })} options={(["open", "button", "hidden"] as const).map((k) => ({ value: k, label: sl.filterLooks[k] }))} />
      </Field>
    </div>
  );
}

export function ShabeCartForm({ settings, onChange }: SettingsProps) {
  const cart: CartSettings = { ...CART_DEFAULTS, ...settings.cart };
  const set = (patch: Partial<CartSettings>) => onChange({ ...settings, cart: { ...cart, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow title={sct.freeShipping} description={sct.freeShippingHint} checked={cart.free_shipping_bar} onCheckedChange={(v) => set({ free_shipping_bar: v })} />
      <SwitchRow title={sct.suggestions} checked={cart.suggestions_enabled} onCheckedChange={(v) => set({ suggestions_enabled: v })} />
      {cart.suggestions_enabled ? (
        <Field label={sct.suggestions}>
          <Segmented value={cart.suggestions} onChange={(v) => set({ suggestions: v })} options={(["offers", "latest"] as const).map((k) => ({ value: k, label: sct.suggestionSources[k] }))} />
        </Field>
      ) : null}
      <SwitchRow title={sct.kitchenNotes} description={sct.kitchenNotesHint} checked={cart.kitchen_notes} onCheckedChange={(v) => set({ kitchen_notes: v })} />
    </div>
  );
}
