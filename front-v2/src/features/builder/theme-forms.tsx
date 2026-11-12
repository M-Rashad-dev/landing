"use client";

import { Check } from "lucide-react";
import { ColorInput } from "@/components/forms/inputs";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { ImageField } from "@/features/media/image-fields";
import type { MediaItem } from "@/features/media/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SocialIcon } from "@/themes/asas/icons";
import { FONTS, PALETTES, PER_PAGE, pick, SOCIALS, type Colors, type FontKey, type FontSize, type MediaUrls, type Settings } from "@/themes/asas/types";

const t = ar.design.theme;
type Errors = Record<string, string>;
type Props = { settings: Settings; onChange: (s: Settings) => void; errors: Errors };
const nullable = (v: string) => (v.trim() === "" ? null : v);

/** Colors, font, size, logo and favicon. */
export function LookForm({ settings, onChange, errors, media, onMedia }: Props & { media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void }) {
  const setColor = (key: keyof Colors, value: string) => onChange({ ...settings, colors: { ...settings.colors, [key]: value } });
  const image = (id: number | null) => {
    const url = id ? pick(media[String(id)], "thumb") : null;
    return id && url ? { id, url } : null;
  };
  const same = (c: Colors) => (Object.keys(c) as Array<keyof Colors>).every((k) => c[k].toLowerCase() === settings.colors[k].toLowerCase());

  return (
    <div className="flex flex-col gap-5">
      <Field label={t.palettes}>
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
                {t.paletteNames[p.key as keyof typeof t.paletteNames]}
              </span>
            </button>
          ))}
        </div>
      </Field>
      {(["primary", "secondary", "background", "text"] as const).map((key) => (
        <Field key={key} label={t.colors[key]} hint={key === "primary" ? t.colors.primaryHint : key === "secondary" ? t.colors.secondaryHint : undefined} error={errors[`colors.${key}`]}>
          <ColorInput value={settings.colors[key]} onChange={(v) => setColor(key, v.toLowerCase())} />
        </Field>
      ))}
      <Field label={t.font} htmlFor={"th-font"} error={errors.font}>
        <Select id={"th-font"} value={settings.font} onValueChange={(v) => onChange({ ...settings, font: v as FontKey })} options={(Object.keys(FONTS) as FontKey[]).map((k) => ({ value: k, label: FONTS[k].label }))} searchable={false} />
      </Field>
      <Field label={t.fontSize} error={errors.font_size}>
        <Segmented value={settings.font_size} onChange={(v) => onChange({ ...settings, font_size: v as FontSize })} options={(["small", "medium", "large"] as const).map((k) => ({ value: k, label: t.fontSizes[k] }))} />
      </Field>
      <Field label={t.logo} hint={t.logoHint} error={errors.logo_media_id}>
        <ImageField
          value={image(settings.logo_media_id)}
          onChange={(item) => {
            if (item) onMedia(item);
            onChange({ ...settings, logo_media_id: item?.id ?? null });
          }}
        />
      </Field>
      <Field label={t.favicon} hint={t.faviconHint} error={errors.favicon_media_id}>
        <ImageField
          value={image(settings.favicon_media_id)}
          onChange={(item) => {
            if (item) onMedia(item);
            onChange({ ...settings, favicon_media_id: item?.id ?? null });
          }}
        />
      </Field>
    </div>
  );
}

export function HeaderForm({ settings, onChange, errors }: Props) {
  const set = (patch: Partial<Settings["header"]>) => onChange({ ...settings, header: { ...settings.header, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">{t.menuNote}</p>
      <Field label={t.announcement} htmlFor={"th-announcement"} hint={t.announcementHint} error={errors["header.announcement"]} optional>
        <Input id={"th-announcement"} maxLength={200} value={settings.header.announcement ?? ""} onChange={(e) => set({ announcement: nullable(e.target.value) })} />
      </Field>
      <SwitchRow title={t.sticky} checked={settings.header.sticky} onCheckedChange={(v) => set({ sticky: v })} />
      <SwitchRow title={t.search} checked={settings.header.search} onCheckedChange={(v) => set({ search: v })} />
    </div>
  );
}

export function FooterForm({ settings, onChange, errors }: Props) {
  const f = settings.footer;
  const set = (patch: Partial<Settings["footer"]>) => onChange({ ...settings, footer: { ...f, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <Field label={t.about} htmlFor={"th-about"} error={errors["footer.about"]} optional>
        <Textarea id={"th-about"} rows={3} maxLength={500} value={f.about ?? ""} onChange={(e) => set({ about: nullable(e.target.value) })} />
      </Field>
      <SwitchRow title={t.showPages} checked={f.show_pages} onCheckedChange={(v) => set({ show_pages: v })} />
      <Field label={t.phone} htmlFor={"th-phone"} error={errors["footer.phone"]} optional>
        <Input id={"th-phone"} dir="ltr" maxLength={30} value={f.phone ?? ""} onChange={(e) => set({ phone: nullable(e.target.value) })} />
      </Field>
      <Field label={t.whatsapp} htmlFor={"th-whatsapp"} error={errors["footer.whatsapp"]} optional>
        <Input id={"th-whatsapp"} dir="ltr" maxLength={30} value={f.whatsapp ?? ""} onChange={(e) => set({ whatsapp: nullable(e.target.value) })} />
      </Field>
      <Field label={t.email} htmlFor={"th-email"} error={errors["footer.email"]} optional>
        <Input id={"th-email"} dir="ltr" type="email" maxLength={191} value={f.email ?? ""} onChange={(e) => set({ email: nullable(e.target.value) })} />
      </Field>
      <Field label={t.address} htmlFor={"th-address"} error={errors["footer.address"]} optional>
        <Input id={"th-address"} maxLength={200} value={f.address ?? ""} onChange={(e) => set({ address: nullable(e.target.value) })} />
      </Field>
      <Field label={t.social}>
        <div className="flex flex-col gap-2">
          {SOCIALS.map((s) => (
            <div key={s}>
              <label className="flex items-center gap-2">
                <SocialIcon network={s} className="size-4 shrink-0 text-ink-2" />
                <span className="sr-only">{ar.storefront.social[s]}</span>
                <Input dir="ltr" maxLength={300} placeholder={t.socialPlaceholder} value={f.social[s] ?? ""} onChange={(e) => set({ social: { ...f.social, [s]: nullable(e.target.value) } })} aria-label={ar.storefront.social[s]} />
              </label>
              {errors[`footer.social.${s}`] ? <p className="mt-1 text-xs text-danger">{errors[`footer.social.${s}`]}</p> : null}
            </div>
          ))}
        </div>
      </Field>
      <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">{t.branding}</p>
    </div>
  );
}

export function GeneralForm({ settings, onChange, errors }: Props) {
  const set = (patch: Partial<Settings["general"]>) => onChange({ ...settings, general: { ...settings.general, ...patch } });
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow title={t.whatsappButton} description={t.whatsappButtonHint} checked={settings.general.whatsapp_button} onCheckedChange={(v) => set({ whatsapp_button: v })} />
      <SwitchRow title={t.showOutOfStock} description={t.showOutOfStockHint} checked={settings.general.show_out_of_stock} onCheckedChange={(v) => set({ show_out_of_stock: v })} />
      <Field label={t.perPage} error={errors["general.products_per_page"]}>
        <Segmented value={String(settings.general.products_per_page)} onChange={(v) => set({ products_per_page: Number(v) })} options={PER_PAGE.map((n) => ({ value: String(n), label: String(n) }))} />
      </Field>
    </div>
  );
}
