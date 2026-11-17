"use client";

import * as React from "react";
import { ColorInput } from "@/components/forms/inputs";
import { SwitchRow } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { ImageField } from "@/features/media/image-fields";
import { ar } from "@/messages/ar";
import { pick, type Colors } from "@/themes/shared/design";
import type { TestimonialsProps } from "@/themes/store/asas/types";
import type { SufiSettings } from "@/themes/store/sufi/types";
import { LinkField, type Errors, type Media } from "./library-forms";

const s = ar.design.sufi;

/* ---------- theme settings that only «صوفي» has ---------- */

type SettingsProps = { settings: SufiSettings; onChange: (s: SufiSettings) => void; errors: Errors };
const st = s.settings;

const SIZES = ["sm", "md", "lg"] as const;

/** Dark colors, the dark logo and the scheme the store opens with (under the shared colors form). */
export function SufiLookExtras({ settings, onChange, errors, media, onMedia }: SettingsProps & Media) {
  const setDark = (key: keyof Colors, value: string) => onChange({ ...settings, colors_dark: { ...settings.colors_dark, [key]: value } });
  const labels = ar.design.theme.colors;
  const darkLogo = settings.logo_dark_media_id ?? null;
  const darkUrl = darkLogo ? pick(media[String(darkLogo)], "thumb") : null;
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={st.darkLogo} hint={st.darkLogoHint} error={errors.logo_dark_media_id}>
        <ImageField
          value={darkLogo && darkUrl ? { id: darkLogo, url: darkUrl } : null}
          onChange={(item) => {
            if (item) onMedia(item);
            onChange({ ...settings, logo_dark_media_id: item?.id ?? null });
          }}
        />
      </Field>
      <Field label={st.dark} hint={st.darkHint}>
        <div className="grid grid-cols-2 gap-2">
          {(["primary", "secondary", "background", "text"] as Array<keyof Colors>).map((key) => (
            <div key={key} className="flex flex-col gap-1 text-xs text-ink-2">
              <label htmlFor={`sf-dark-${key}`}>{labels[key]}</label>
              <ColorInput id={`sf-dark-${key}`} value={settings.colors_dark[key]} onChange={(v) => setDark(key, v.toLowerCase())} />
              {errors[`colors_dark.${key}`] ? <span className="text-danger">{errors[`colors_dark.${key}`]}</span> : null}
            </div>
          ))}
        </div>
      </Field>
      <Field label={st.appearance}>
        <Segmented value={settings.appearance.default} onChange={(v) => onChange({ ...settings, appearance: { ...settings.appearance, default: v } })} options={(["light", "dark", "system"] as const).map((k) => ({ value: k, label: st.appearances[k] }))} />
      </Field>
      <SwitchRow title={st.toggle} checked={settings.appearance.toggle} onCheckedChange={(v) => onChange({ ...settings, appearance: { ...settings.appearance, toggle: v } })} />
    </div>
  );
}

export function SufiHeaderExtras({ settings, onChange }: SettingsProps) {
  const set = (patch: Partial<SufiSettings["header"]>) => onChange({ ...settings, header: { ...settings.header, ...patch } });
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Field label={st.layout}>
        <Segmented value={settings.header.layout} onChange={(v) => set({ layout: v })} options={(["center", "start", "end"] as const).map((k) => ({ value: k, label: st.layouts[k] }))} />
      </Field>
      <SwitchRow title={st.topbar} description={st.topbarHint} checked={settings.header.topbar} onCheckedChange={(v) => set({ topbar: v })} />
      <Field label={st.headerHeight}>
        <Segmented value={settings.header.height ?? "md"} onChange={(v) => set({ height: v })} options={SIZES.map((k) => ({ value: k, label: st.sizes[k] }))} />
      </Field>
      <Field label={st.logoSize}>
        <Segmented value={settings.header.logo_size ?? "md"} onChange={(v) => set({ logo_size: v })} options={SIZES.map((k) => ({ value: k, label: st.sizes[k] }))} />
      </Field>
    </div>
  );
}

/** The store logo at the top of the footer, and its size. */
export function SufiFooterExtras({ settings, onChange }: SettingsProps) {
  const f = settings.footer;
  const set = (patch: Partial<SufiSettings["footer"]>) => onChange({ ...settings, footer: { ...f, ...patch } });
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <SwitchRow title={st.footerLogo} description={st.footerLogoHint} checked={f.logo ?? true} onCheckedChange={(v) => set({ logo: v })} />
      {(f.logo ?? true) ? (
        <Field label={st.logoSize}>
          <Segmented value={f.logo_size ?? "md"} onChange={(v) => set({ logo_size: v })} options={SIZES.map((k) => ({ value: k, label: st.sizes[k] }))} />
        </Field>
      ) : null}
    </div>
  );
}

export function SufiGeneralExtras({ settings, onChange, errors }: SettingsProps) {
  const g = settings.general;
  const set = (patch: Partial<SufiSettings["general"]>) => onChange({ ...settings, general: { ...g, ...patch } });
  const tab = g.offers_tab;
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      {g.whatsapp_button ? (
        <Field label={st.whatsappNumber} htmlFor="sf-wa-number" hint={st.numberHint(settings.footer.whatsapp)} error={errors["general.whatsapp_number"]} optional>
          <Input id="sf-wa-number" dir="ltr" maxLength={30} placeholder="01xxxxxxxxx" value={g.whatsapp_number ?? ""} onChange={(e) => set({ whatsapp_number: e.target.value.trim() === "" ? null : e.target.value })} />
        </Field>
      ) : null}
      <SwitchRow title={st.floatingCall} description={st.floatingCallHint} checked={g.floating_call} onCheckedChange={(v) => set({ floating_call: v })} />
      {g.floating_call ? (
        <Field label={st.callPhone} htmlFor="sf-call-phone" hint={st.numberHint(settings.footer.phone)} error={errors["general.call_phone"]} optional>
          <Input id="sf-call-phone" dir="ltr" maxLength={30} placeholder="01xxxxxxxxx" value={g.call_phone ?? ""} onChange={(e) => set({ call_phone: e.target.value.trim() === "" ? null : e.target.value })} />
        </Field>
      ) : null}
      <SwitchRow title={st.animations} description={st.animationsHint} checked={g.animations} onCheckedChange={(v) => set({ animations: v })} />
      <SwitchRow title={st.offersTab} description={st.offersTabHint} checked={tab.enabled} onCheckedChange={(v) => set({ offers_tab: { ...tab, enabled: v, label: v && !tab.label ? ar.sufi.offers : tab.label } })} />
      {tab.enabled ? (
        <>
          <Field label={st.offersLabel} htmlFor="sf-offers-label" error={errors["general.offers_tab.label"]} required>
            <Input id="sf-offers-label" maxLength={30} value={tab.label ?? ""} onChange={(e) => set({ offers_tab: { ...tab, label: e.target.value } })} />
          </Field>
          <LinkField value={tab.link} onChange={(link) => set({ offers_tab: { ...tab, link } })} errors={errors} prefix="general.offers_tab.link" />
        </>
      ) : null}
    </div>
  );
}

/** «صوفي» lets the merchant show the reviews as a slider or as a list (on every screen). */
export function SufiTestimonialsExtras({ props, onChange }: { props: TestimonialsProps; onChange: (p: TestimonialsProps) => void }) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <Field label={st.reviewsLayout} hint={st.reviewsLayoutHint}>
        <Segmented value={props.layout ?? "slider"} onChange={(v) => onChange({ ...props, layout: v as "slider" | "list" })} options={(["slider", "list"] as const).map((k) => ({ value: k, label: st.reviewsLayouts[k] }))} />
      </Field>
    </div>
  );
}
