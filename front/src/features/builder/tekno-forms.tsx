"use client";

import { BadgeCheck, Headset, Plus, Wrench } from "lucide-react";
import { ColorInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MultiSelect, Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { useCategories } from "@/features/catalog/categories/api";
import { useProductChoices } from "@/features/promotions/api";
import { useStorePages } from "@/features/store-pages/api";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { FEATURE_ICONS } from "@/themes/store/asas/icons";
import type { FeaturesProps, TestimonialsProps } from "@/themes/store/asas/types";
import type { Link, SufiSection } from "@/themes/store/sufi/types";
import { installmentOf } from "@/themes/store/tekno/installments";
import { INSTALLMENT_MONTHS, TEKNO_CARD_DEFAULTS, TECH_ICON_KEYS, type DealOfDayProps, type HeroSlide, type HeroTile, type MegaItem, type ServicesProps, type TechHeroProps, type TechIcon, type TeknoCardSettings, type TeknoFeaturesProps, type TeknoInstallments, type TeknoSettings, type TeknoTabsProps, type TeknoTestimonialsProps } from "@/themes/store/tekno/types";
import { ColorChoice } from "./rawaq-forms";
import { ImagePick, LibrarySectionForm, LinkField, Text, toLocalInput, type Errors, type Media } from "./library-forms";
import { Card, FeaturesForm, TestimonialsForm, move, type FeatureIcon } from "./section-forms";

const k = ar.design.tekno;
const sf = ar.design.sufi;
const NONE: Link = { type: "none", target_id: null, url: null };
const ALL: Link = { type: "all_products", target_id: null, url: null };

type Props<P> = { props: P; onChange: (p: P) => void; errors: Errors };
type SettingsProps = { settings: TeknoSettings; onChange: (s: TeknoSettings) => void; errors: Errors } & Media;

/** The trust strip's and services' icons in the Builder (back end: StoreSections::TECH_ICONS). */
const TECH_ICONS: FeatureIcon[] = TECH_ICON_KEYS.map((key) => ({ key, Icon: key === "wrench" ? Wrench : key === "headset" ? Headset : key === "badge-check" ? BadgeCheck : FEATURE_ICONS[key] }));

/** A list of short texts (chips, providers) with add / remove. */
function TextList({ label, values, onChange, max, length, itemLabel, addLabel, error }: { label: string; values: string[]; onChange: (v: string[]) => void; max: number; length: number; itemLabel: (n: number) => string; addLabel: string; error?: string }) {
  return (
    <Field label={label} error={error} optional>
      <div className="flex flex-col gap-2">
        {values.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label={itemLabel(i + 1)} maxLength={length} value={value} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
            <Button size="sm" variant="ghost" onClick={() => onChange(values.filter((_, j) => j !== i))}>
              {sf.remove}
            </Button>
          </div>
        ))}
        {values.length < max ? (
          <Button variant="outline" onClick={() => onChange([...values, ""])}>
            <Plus />
            {addLabel}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

/** The store's products to pick one (the first option: none). */
function ProductPick({ id, label, hint, value, onChange, error, optional = false }: { id: string; label: string; hint?: string; value: number | null; onChange: (v: number | null) => void; error?: string; optional?: boolean }) {
  const products = useProductChoices();
  const options = (products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }));
  return (
    <Field label={label} hint={hint} htmlFor={id} error={error} required={!optional} optional={optional}>
      <Select id={id} value={value === null ? "" : String(value)} onValueChange={(v) => onChange(v === "" ? null : Number(v))} options={options} emptyLabel={optional ? k.hero.noProduct : undefined} placeholder={ar.design.rawaq.routine.product} />
    </Field>
  );
}

/* ---------- sections ---------- */

export function TechHeroForm({ props, onChange, errors, media, onMedia }: Props<TechHeroProps> & Media) {
  const setSlide = (i: number, patch: Partial<HeroSlide>) => onChange({ ...props, slides: props.slides.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setTile = (i: number, patch: Partial<HeroTile>) => onChange({ ...props, tiles: props.tiles.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const s = k.starter.hero;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-3">{k.hero.slidesHint}</p>
      {errors.slides ? <p className="text-sm text-danger">{errors.slides}</p> : null}
      {props.slides.map((slide, i) => {
        const e = (key: string) => errors[`slides.${i}.${key}`];
        return (
          <Card
            key={i}
            title={k.hero.slide(i + 1)}
            removeLabel={sf.remove}
            onUp={i > 0 ? () => onChange({ ...props, slides: move(props.slides, i, i - 1) }) : undefined}
            onDown={i < props.slides.length - 1 ? () => onChange({ ...props, slides: move(props.slides, i, i + 1) }) : undefined}
            onRemove={props.slides.length > 1 ? () => onChange({ ...props, slides: props.slides.filter((_, j) => j !== i) }) : undefined}
          >
            <Text id={`th-${i}-kicker`} label={sf.kicker} value={slide.kicker} onChange={(v) => setSlide(i, { kicker: v })} error={e("kicker")} max={40} />
            <Text id={`th-${i}-title`} label={k.hero.title} value={slide.title} onChange={(v) => setSlide(i, { title: v ?? "" })} error={e("title")} max={90} required />
            <Text id={`th-${i}-highlight`} label={k.hero.highlight} hint={k.hero.highlightHint} value={slide.highlight} onChange={(v) => setSlide(i, { highlight: v })} error={e("highlight")} max={30} />
            <Text id={`th-${i}-subtitle`} label={k.hero.subtitle} value={slide.subtitle} onChange={(v) => setSlide(i, { subtitle: v })} error={e("subtitle")} max={200} area />
            <ImagePick id={slide.media_id} onChange={(id) => setSlide(i, { media_id: id })} media={media} onMedia={onMedia} error={e("media_id")} optional />
            <TextList label={k.hero.chips} values={slide.chips} onChange={(chips) => setSlide(i, { chips })} max={4} length={20} itemLabel={k.hero.chip} addLabel={k.hero.addChip} error={e("chips")} />
            <ProductPick id={`th-${i}-product`} label={k.hero.product} hint={k.hero.productHint} value={slide.product_id} onChange={(v) => setSlide(i, { product_id: v })} error={e("product_id")} optional />
            <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <Text id={`th-${i}-button`} label={k.hero.button} value={slide.button_label} onChange={(v) => setSlide(i, { button_label: v ?? "" })} error={e("button_label")} max={30} required />
              <LinkField value={slide.link} onChange={(link) => setSlide(i, { link })} errors={errors} prefix={`slides.${i}.link`} />
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <Text id={`th-${i}-second`} label={k.hero.second} value={slide.second_label} onChange={(v) => setSlide(i, { second_label: v })} error={e("second_label")} max={30} />
              {slide.second_label ? <LinkField value={slide.second_link} onChange={(link) => setSlide(i, { second_link: link })} errors={errors} prefix={`slides.${i}.second_link`} /> : null}
            </div>
          </Card>
        );
      })}
      {props.slides.length < 4 ? (
        <Button variant="outline" onClick={() => onChange({ ...props, slides: [...props.slides, { kicker: null, title: s.title, highlight: null, subtitle: null, media_id: null, chips: [], product_id: null, button_label: s.button, link: ALL, second_label: null, second_link: NONE }] })}>
          <Plus />
          {k.hero.addSlide}
        </Button>
      ) : null}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-sm font-semibold">{k.hero.tiles}</p>
        <p className="text-xs text-ink-3">{k.hero.tilesHint}</p>
        {props.tiles.map((tile, i) => {
          const e = (key: string) => errors[`tiles.${i}.${key}`];
          return (
            <Card key={i} title={k.hero.tile(i + 1)} removeLabel={sf.remove} onRemove={() => onChange({ ...props, tiles: props.tiles.filter((_, j) => j !== i) })}>
              <Text id={`tt-${i}-kicker`} label={sf.kicker} value={tile.kicker} onChange={(v) => setTile(i, { kicker: v })} error={e("kicker")} max={30} />
              <Text id={`tt-${i}-title`} label={k.hero.title} value={tile.title} onChange={(v) => setTile(i, { title: v ?? "" })} error={e("title")} max={50} required />
              <Text id={`tt-${i}-text`} label={k.hero.tileText} hint={k.hero.tileTextHint} value={tile.text} onChange={(v) => setTile(i, { text: v })} error={e("text")} max={40} />
              <ImagePick id={tile.media_id} onChange={(id) => setTile(i, { media_id: id })} media={media} onMedia={onMedia} error={e("media_id")} optional />
              <ColorChoice id={`tt-${i}-color`} label={k.hero.color} value={tile.color} onChange={(color) => setTile(i, { color })} />
              <LinkField value={tile.link} onChange={(link) => setTile(i, { link })} errors={errors} prefix={`tiles.${i}.link`} />
            </Card>
          );
        })}
        {props.tiles.length < 2 ? (
          <Button variant="outline" onClick={() => onChange({ ...props, tiles: [...props.tiles, { media_id: null, kicker: null, title: k.hero.tile(props.tiles.length + 1), text: null, color: null, link: ALL }] })}>
            <Plus />
            {k.hero.addTile}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function DealOfDayForm({ props, onChange, errors }: Props<DealOfDayProps>) {
  const set = (patch: Partial<DealOfDayProps>) => onChange({ ...props, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <ProductPick id="dd-product" label={k.deal.product} hint={k.deal.productHint} value={props.product_id} onChange={(v) => set({ product_id: v })} error={errors.product_id} />
      <Text id="dd-kicker" label={sf.kicker} value={props.kicker} onChange={(v) => set({ kicker: v })} error={errors.kicker} max={50} />
      <Text id="dd-title" label={k.deal.title} hint={k.deal.titleHint} value={props.title} onChange={(v) => set({ title: v })} error={errors.title} max={90} />
      <Field label={k.deal.chips}>
        <Segmented value={props.chips === null ? "product" : "own"} onChange={(v) => set({ chips: v === "product" ? null : (props.chips ?? []) })} options={[{ value: "product", label: k.deal.productChips }, { value: "own", label: k.deal.ownChips }]} />
      </Field>
      {props.chips !== null ? <TextList label={k.deal.chips} values={props.chips} onChange={(chips) => set({ chips })} max={4} length={20} itemLabel={k.hero.chip} addLabel={k.hero.addChip} error={errors.chips} /> : null}
      <Field label={k.deal.ends}>
        <Segmented value={props.ends} onChange={(v) => set({ ends: v, ends_at: v === "date" ? props.ends_at : null })} options={(["midnight", "date"] as const).map((x) => ({ value: x, label: k.deal.endsChoices[x] }))} />
      </Field>
      {props.ends === "date" ? (
        <Field label={k.deal.endsAt} htmlFor="dd-ends" error={errors.ends_at} required>
          <Input id="dd-ends" type="datetime-local" dir="ltr" value={props.ends_at ? toLocalInput(props.ends_at) : ""} onChange={(e) => e.target.value && set({ ends_at: new Date(e.target.value).toISOString() })} />
        </Field>
      ) : null}
      <Field label={k.deal.stockStart} hint={k.deal.stockStartHint} htmlFor="dd-stock" error={errors.stock_start} optional>
        <Input id="dd-stock" type="number" min={1} dir="ltr" value={props.stock_start ?? ""} onChange={(e) => set({ stock_start: e.target.value === "" ? null : Math.max(1, Math.round(Number(e.target.value))) })} />
      </Field>
      <Text id="dd-button" label={sf.buttonLabel} value={props.button_label} onChange={(v) => set({ button_label: v ?? "" })} error={errors.button_label} max={30} required />
      <SwitchRow title={k.deal.installment} checked={props.show_installment} onCheckedChange={(v) => set({ show_installment: v })} />
    </div>
  );
}

export function ServicesForm({ props, onChange, errors }: Props<ServicesProps>) {
  const setItem = (i: number, patch: Partial<ServicesProps["items"][number]>) => onChange({ ...props, items: props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4">
      <Text id="sv-title" label={sf.title} value={props.title} onChange={(v) => onChange({ ...props, title: v })} error={errors.title} max={80} />
      {errors.items ? <p className="text-sm text-danger">{errors.items}</p> : null}
      {props.items.map((item, i) => (
        <Card
          key={i}
          title={k.services.item(i + 1)}
          removeLabel={sf.remove}
          onUp={i > 0 ? () => onChange({ ...props, items: move(props.items, i, i - 1) }) : undefined}
          onDown={i < props.items.length - 1 ? () => onChange({ ...props, items: move(props.items, i, i + 1) }) : undefined}
          onRemove={props.items.length > 2 ? () => onChange({ ...props, items: props.items.filter((_, j) => j !== i) }) : undefined}
        >
          <Field label={ar.design.features.icon}>
            <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={ar.design.features.icon}>
              {TECH_ICONS.map(({ key, Icon }) => (
                <button key={key} type="button" role="radio" aria-checked={item.icon === key} aria-label={key} onClick={() => setItem(i, { icon: key as TechIcon })} className={cn("flex size-9 items-center justify-center rounded-md border", item.icon === key ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-ink-2 hover:bg-surface-2")}>
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </Field>
          <Text id={`sv-${i}-title`} label={sf.title} value={item.title} onChange={(v) => setItem(i, { title: v ?? "" })} error={errors[`items.${i}.title`]} max={40} required />
          <Text id={`sv-${i}-text`} label={k.services.text} value={item.text} onChange={(v) => setItem(i, { text: v })} error={errors[`items.${i}.text`]} max={120} area />
        </Card>
      ))}
      {props.items.length < 4 ? (
        <Button variant="outline" onClick={() => onChange({ ...props, items: [...props.items, { icon: "badge-check", title: k.starter.newService, text: null }] })}>
          <Plus />
          {k.services.add}
        </Button>
      ) : null}
    </div>
  );
}

/** The trust strip: five items and the electronics icons. */
export function TeknoFeaturesForm({ props, onChange, errors }: Props<TeknoFeaturesProps>) {
  return <FeaturesForm props={props as unknown as FeaturesProps} onChange={(p) => onChange(p as unknown as TeknoFeaturesProps)} errors={errors} max={5} icons={TECH_ICONS} hint={k.trustHint} />;
}

/** The product tabs with a kicker above their title. */
export function TeknoTabsForm({ section, onChange, errors, media, onMedia }: { section: { id: string; type: "product_tabs"; visible: boolean; props: TeknoTabsProps }; onChange: (p: TeknoTabsProps) => void; errors: Errors } & Media) {
  const props = section.props;
  return (
    <div className="flex flex-col gap-4">
      <Text id="tb-kicker" label={k.tabsKicker} value={props.kicker} onChange={(v) => onChange({ ...props, kicker: v })} error={errors.kicker} max={40} />
      <LibrarySectionForm section={section as unknown as SufiSection} onChange={(p) => onChange({ ...(p as TeknoTabsProps), kicker: props.kicker })} errors={errors} media={media} onMedia={onMedia} />
    </div>
  );
}

/** Reviews that may say what was bought («اشترى: …»). */
export function TeknoTestimonialsForm({ props, onChange, errors }: Props<TeknoTestimonialsProps>) {
  return <TestimonialsForm props={props as unknown as TestimonialsProps} onChange={(p) => onChange(p as unknown as TeknoTestimonialsProps)} errors={errors} product={{ label: k.testimonialProduct, hint: k.testimonialProductHint }} />;
}

/* ---------- settings groups ---------- */

export function TeknoLookExtras({ settings, onChange }: SettingsProps) {
  const colors = settings.colors;
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={k.look.dark} hint={k.look.darkHint}>
        <ColorInput id="tk-dark" value={colors.dark} onChange={(v) => onChange({ ...settings, colors: { ...colors, dark: v.toLowerCase() } })} />
      </Field>
      <Field label={k.look.deal} hint={k.look.dealHint}>
        <ColorInput id="tk-deal" value={colors.deal} onChange={(v) => onChange({ ...settings, colors: { ...colors, deal: v.toLowerCase() } })} />
      </Field>
      <SwitchRow title={k.look.display} description={k.look.displayHint} checked={settings.display_font} onCheckedChange={(v) => onChange({ ...settings, display_font: v })} />
      <Field label={k.look.button}>
        <Segmented value={settings.button} onChange={(v) => onChange({ ...settings, button: v })} options={(["rounded", "pill", "square"] as const).map((x) => ({ value: x, label: k.look.buttons[x] }))} />
      </Field>
    </div>
  );
}

export function TeknoHeaderExtras({ settings, onChange, errors }: SettingsProps) {
  const h = settings.header;
  const set = (patch: Partial<TeknoSettings["header"]>) => onChange({ ...settings, header: { ...h, ...patch } });
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={k.header.hotline} hint={k.header.hotlineHint} htmlFor="tk-hotline" error={errors["header.hotline"]} optional>
        <Input id="tk-hotline" dir="ltr" maxLength={30} placeholder="19999" value={h.hotline ?? ""} onChange={(e) => set({ hotline: e.target.value.trim() === "" ? null : e.target.value })} />
      </Field>
      <SwitchRow title={k.header.track} checked={h.track_link} onCheckedChange={(v) => set({ track_link: v })} />
      <SwitchRow title={k.header.searchCategories} description={k.header.searchCategoriesHint} checked={h.search_categories} onCheckedChange={(v) => set({ search_categories: v })} />
    </div>
  );
}

export function TeknoFooterExtras({ settings, onChange, errors }: SettingsProps) {
  const pages = useStorePages();
  const options = (pages.data ?? []).filter((p) => p.is_published).map((p) => ({ value: String(p.id), label: p.title }));
  const f = settings.footer;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <Field label={k.footer.help} hint={k.footer.helpHint} error={errors["footer.help_links"]} optional>
        {pages.isSuccess && options.length === 0 ? (
          <p className="text-sm text-ink-3">{k.footer.noPages}</p>
        ) : (
          <MultiSelect value={(f.help_links ?? []).map(String)} onChange={(v) => onChange({ ...settings, footer: { ...f, help_links: v.slice(0, 4).map(Number) } })} options={options} countLabel={k.footer.count} />
        )}
      </Field>
    </div>
  );
}

export function MegaMenuForm({ settings, onChange, errors, media, onMedia }: SettingsProps) {
  const categories = useCategories();
  const menu = settings.mega_menu;
  const options = (categories.data ?? []).filter((c) => c.parent_id === null).map((c) => ({ value: String(c.id), label: c.name }));
  const setMenu = (patch: Partial<TeknoSettings["mega_menu"]>) => onChange({ ...settings, mega_menu: { ...menu, ...patch } });
  const setItem = (i: number, patch: Partial<MegaItem>) => setMenu({ items: menu.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const e = (key: string) => errors[`mega_menu.${key}`];
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow title={k.mega.enabled} description={k.mega.enabledHint} checked={menu.enabled} onCheckedChange={(v) => setMenu({ enabled: v })} />
      {menu.enabled ? (
        <>
          <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">{k.mega.auto}</p>
          {menu.items.map((item, i) => (
            <Card
              key={i}
              title={options.find((o) => o.value === String(item.category_id))?.label ?? k.mega.item(i + 1)}
              removeLabel={k.mega.remove}
              onUp={i > 0 ? () => setMenu({ items: move(menu.items, i, i - 1) }) : undefined}
              onDown={i < menu.items.length - 1 ? () => setMenu({ items: move(menu.items, i, i + 1) }) : undefined}
              onRemove={() => setMenu({ items: menu.items.filter((_, j) => j !== i) })}
            >
              <Field label={k.mega.category} htmlFor={`mm-${i}-cat`} error={e(`items.${i}.category_id`)} required>
                <Select id={`mm-${i}-cat`} value={String(item.category_id)} onValueChange={(v) => setItem(i, { category_id: Number(v) })} options={options} />
              </Field>
              <p className="text-xs text-ink-3">{k.mega.columnsHint}</p>
              {item.columns.map((column, c) => (
                <div key={c} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input aria-label={k.mega.columnTitle} maxLength={30} value={column.title} placeholder={k.mega.column(c + 1)} onChange={(ev) => setItem(i, { columns: item.columns.map((x, j) => (j === c ? { ...x, title: ev.target.value } : x)) })} />
                    <Button size="sm" variant="ghost" onClick={() => setItem(i, { columns: item.columns.filter((_, j) => j !== c) })}>
                      {k.mega.remove}
                    </Button>
                  </div>
                  {e(`items.${i}.columns.${c}.title`) ? <p className="text-xs text-danger">{e(`items.${i}.columns.${c}.title`)}</p> : null}
                  {e(`items.${i}.columns.${c}.links`) ? <p className="text-xs text-danger">{e(`items.${i}.columns.${c}.links`)}</p> : null}
                  {column.links.map((link, l) => {
                    const setLink = (patch: Partial<typeof link>) => setItem(i, { columns: item.columns.map((x, j) => (j === c ? { ...x, links: x.links.map((y, m) => (m === l ? { ...y, ...patch } : y)) } : x)) });
                    return (
                      <div key={l} className="flex flex-col gap-2 rounded-lg bg-surface-2 p-2">
                        <div className="flex items-center gap-2">
                          <Input aria-label={k.mega.link(l + 1)} maxLength={30} value={link.label} placeholder={k.mega.linkLabel} onChange={(ev) => setLink({ label: ev.target.value })} />
                          <Button size="sm" variant="ghost" onClick={() => setItem(i, { columns: item.columns.map((x, j) => (j === c ? { ...x, links: x.links.filter((_, m) => m !== l) } : x)) })}>
                            {k.mega.remove}
                          </Button>
                        </div>
                        <LinkField value={link.link} onChange={(next) => setLink({ link: next })} errors={errors} prefix={`mega_menu.items.${i}.columns.${c}.links.${l}.link`} />
                      </div>
                    );
                  })}
                  {column.links.length < 8 ? (
                    <Button size="sm" variant="outline" onClick={() => setItem(i, { columns: item.columns.map((x, j) => (j === c ? { ...x, links: [...x.links, { label: "", link: ALL }] } : x)) })}>
                      <Plus />
                      {k.mega.addLink}
                    </Button>
                  ) : null}
                </div>
              ))}
              {item.columns.length < 2 ? (
                <Button variant="outline" onClick={() => setItem(i, { columns: [...item.columns, { title: k.mega.column(item.columns.length + 1), links: [{ label: "", link: ALL }] }] })}>
                  <Plus />
                  {k.mega.addColumn}
                </Button>
              ) : null}
              <SwitchRow title={k.mega.promo} checked={item.promo !== null} onCheckedChange={(v) => setItem(i, { promo: v ? { media_id: null, title: options.find((o) => o.value === String(item.category_id))?.label ?? "", text: null, link: ALL } : null })} />
              {item.promo ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                  <Text id={`mm-${i}-ptitle`} label={k.mega.promoTitle} value={item.promo.title} onChange={(v) => setItem(i, { promo: { ...item.promo!, title: v ?? "" } })} error={e(`items.${i}.promo.title`)} max={40} required />
                  <Text id={`mm-${i}-ptext`} label={k.mega.promoText} value={item.promo.text} onChange={(v) => setItem(i, { promo: { ...item.promo!, text: v } })} error={e(`items.${i}.promo.text`)} max={40} />
                  <ImagePick id={item.promo.media_id} onChange={(media_id) => setItem(i, { promo: { ...item.promo!, media_id } })} media={media} onMedia={onMedia} error={e(`items.${i}.promo.media_id`)} optional />
                  <LinkField value={item.promo.link} onChange={(link) => setItem(i, { promo: { ...item.promo!, link } })} errors={errors} prefix={`mega_menu.items.${i}.promo.link`} />
                </div>
              ) : null}
            </Card>
          ))}
          {menu.items.length < 10 && options.length ? (
            <Button variant="outline" onClick={() => setMenu({ items: [...menu.items, { category_id: Number((options.find((o) => !menu.items.some((x) => String(x.category_id) === o.value)) ?? options[0]).value), columns: [], promo: null }] })}>
              <Plus />
              {k.mega.add}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Settings saved before the group existed come without it: its defaults fill it. */
const cardOf = (settings: TeknoSettings): TeknoCardSettings => ({ ...TEKNO_CARD_DEFAULTS, ...settings.product_card });

export function TeknoCardForm({ settings, onChange, errors }: SettingsProps) {
  const card = cardOf(settings);
  const set = (patch: Partial<TeknoCardSettings>) => onChange({ ...settings, product_card: { ...card, ...patch } });
  return (
    <div className="flex flex-col gap-3">
      <SwitchRow title={k.card.specs} description={k.card.specsHint} checked={card.show_specs} onCheckedChange={(v) => set({ show_specs: v })} />
      <SwitchRow title={k.card.compare} checked={card.show_compare} onCheckedChange={(v) => set({ show_compare: v })} />
      <SwitchRow title={k.card.rating} checked={card.show_rating} onCheckedChange={(v) => set({ show_rating: v })} />
      <SwitchRow title={k.card.installment} description={k.card.installmentHint} checked={card.show_installment} onCheckedChange={(v) => set({ show_installment: v })} />
      <Field label={k.card.lowStock} hint={k.card.lowStockHint} htmlFor="tk-low" error={errors["product_card.low_stock"]}>
        <Input id="tk-low" type="number" min={0} max={20} dir="ltr" value={card.low_stock} onChange={(e) => set({ low_stock: Math.min(20, Math.max(0, Math.round(Number(e.target.value) || 0))) })} />
      </Field>
      <Text id="tk-badge" label={k.card.badge} hint={k.card.badgeHint} value={card.badge_label} onChange={(v) => set({ badge_label: v })} error={errors["product_card.badge_label"]} max={30} />
      <Field label={`${k.card.radius} (${card.radius}px)`} htmlFor="tk-radius">
        <input id="tk-radius" type="range" min={0} max={24} value={card.radius} onChange={(e) => set({ radius: Number(e.target.value) })} className="w-full" />
      </Field>
    </div>
  );
}

export function InstallmentsForm({ settings, onChange, errors }: SettingsProps) {
  const plan: TeknoInstallments = settings.installments;
  const set = (patch: Partial<TeknoInstallments>) => onChange({ ...settings, installments: { ...plan, ...patch } });
  const toggleMonth = (m: number) => {
    const months = plan.months.includes(m) ? plan.months.filter((x) => x !== m) : [...plan.months, m].sort((a, b) => a - b);
    if (months.length === 0 || months.length > 6) return;
    set({ months, card_months: months.includes(plan.card_months) ? plan.card_months : months[Math.floor(months.length / 2)] });
  };
  const sample = Math.max(plan.min_price, 10000);
  const example = installmentOf(sample, { ...plan, enabled: true });
  const e = (key: string) => errors[`installments.${key}`];
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow title={k.installments.enabled} description={k.installments.enabledHint} checked={plan.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      {plan.enabled ? (
        <>
          <Field label={k.installments.months} hint={k.installments.monthsHint} error={e("months")}>
            <div className="flex flex-wrap gap-2" role="group" aria-label={k.installments.months}>
              {INSTALLMENT_MONTHS.map((m) => (
                <button key={m} type="button" aria-pressed={plan.months.includes(m)} onClick={() => toggleMonth(m)} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", plan.months.includes(m) ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-ink-2")}>
                  {k.installments.month(m)}
                </button>
              ))}
            </div>
          </Field>
          <Field label={k.installments.cardMonths} error={e("card_months")}>
            <Segmented value={String(plan.card_months)} onChange={(v) => set({ card_months: Number(v) })} options={plan.months.map((m) => ({ value: String(m), label: String(m) }))} />
          </Field>
          <Field label={k.installments.interest} hint={k.installments.interestHint} htmlFor="tk-interest" error={e("interest_percent")}>
            <Input id="tk-interest" type="number" min={0} max={100} dir="ltr" value={plan.interest_percent} onChange={(ev) => set({ interest_percent: Math.min(100, Math.max(0, Math.round(Number(ev.target.value) || 0))) })} />
          </Field>
          <Field label={k.installments.minPrice} htmlFor="tk-min" error={e("min_price")}>
            <Input id="tk-min" type="number" min={0} dir="ltr" value={plan.min_price} onChange={(ev) => set({ min_price: Math.max(0, Math.round(Number(ev.target.value) || 0)) })} />
          </Field>
          {example ? <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">{k.installments.example(formatMoney(sample), example.months, formatMoney(example.amount))}</p> : null}
          <TextList label={k.installments.providers} values={plan.providers} onChange={(providers) => set({ providers })} max={6} length={30} itemLabel={k.installments.provider} addLabel={k.installments.addProvider} error={e("providers")} />
          <Text id="tk-note" label={k.installments.note} value={plan.note} onChange={(v) => set({ note: v })} error={e("note")} max={120} />
        </>
      ) : null}
    </div>
  );
}
