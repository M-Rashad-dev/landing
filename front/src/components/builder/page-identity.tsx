"use client";

import { Fingerprint, Palette, RotateCcw } from "lucide-react";
import { ColorInput } from "@/components/forms/color-input";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useIdentity } from "@/lib/identity/api";
import { designFromIdentity } from "@/lib/identity/page-design";
import { BUTTON_RADII, RADIUS_VALUES } from "@/lib/identity/style";
import { FONT_KEYS, FONTS, fontStack } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import type { PageDesign } from "@/themes/types";
import { useBuilder } from "./context";

const t = ar.builder.pageIdentity;
const COLOR_KEYS = ["primary", "secondary", "accent", "background", "foreground", "muted", "border"] as const;

/** Ready palettes for a quick start (each one passes AA for text on its background). */
const PALETTES: Array<{ key: string; colors: Record<(typeof COLOR_KEYS)[number], string> }> = [
  { key: "lapis", colors: { primary: "#2A44B8", secondary: "#ECEFFB", accent: "#E3A21A", background: "#FFFFFF", foreground: "#16182B", muted: "#6A6759", border: "#E5E0D4" } },
  { key: "nile", colors: { primary: "#0F766E", secondary: "#E6F4F1", accent: "#F59E0B", background: "#FFFFFF", foreground: "#0F1F1C", muted: "#5B6B67", border: "#D9E7E3" } },
  { key: "rose", colors: { primary: "#BE185D", secondary: "#FCE7F3", accent: "#F59E0B", background: "#FFFBFD", foreground: "#2A0E1B", muted: "#7A5A68", border: "#F3D6E3" } },
  { key: "sunset", colors: { primary: "#C2410C", secondary: "#FFEDD5", accent: "#0EA5E9", background: "#FFFBF7", foreground: "#2B160A", muted: "#7C5E4E", border: "#F5DCCB" } },
  { key: "night", colors: { primary: "#F5C542", secondary: "#1F2433", accent: "#38BDF8", background: "#0E111A", foreground: "#F4F5F8", muted: "#9AA3B5", border: "#2A3142" } },
  { key: "olive", colors: { primary: "#4D7C0F", secondary: "#F1F7E6", accent: "#B45309", background: "#FFFFFF", foreground: "#1A2310", muted: "#64705A", border: "#DDE7CF" } },
];

/**
 * Page settings → identity: use a saved identity as is, or a look made only for this page.
 * The custom look lives in the page content (content.design): autosaved, undoable, live in
 * the preview, and visible to visitors only after publishing.
 */
export function PageIdentity({
  identities,
  metaSaving,
  onMetaChange,
}: {
  identities: Array<{ id: number; name: string }>;
  metaSaving: boolean;
  onMetaChange: (patch: { identity_id?: number }) => void;
}) {
  const page = useBuilder((s) => s.page);
  const design = useBuilder((s) => s.content.design);
  const setDesign = useBuilder((s) => s.setDesign);
  const base = useIdentity(page?.identity_id ?? null);
  const custom = Boolean(design);

  const startCustom = () => {
    if (base.data) setDesign(designFromIdentity(base.data));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={ar.builder.identity}>
        <ModeCard active={!custom} icon={Fingerprint} title={t.saved} hint={t.savedHint} onClick={() => setDesign(null)} />
        <ModeCard active={custom} icon={Palette} title={t.custom} hint={t.customHint} onClick={startCustom} disabled={!base.data && !custom} />
      </div>

      <FormField label={custom ? t.baseIdentity : ar.builder.identity} htmlFor="b-identity" hint={custom ? t.baseHint : undefined}>
        <Select id="b-identity" disabled={metaSaving} value={String(page?.identity_id ?? "")} onChange={(event) => onMetaChange({ identity_id: Number(event.target.value) })} options={identities.map((i) => ({ value: String(i.id), label: i.name }))} />
      </FormField>

      {design ? <DesignEditor design={design} onChange={setDesign} onReset={startCustom} /> : null}
    </div>
  );
}

function ModeCard({ active, icon: Icon, title, hint, onClick, disabled }: { active: boolean; icon: typeof Palette; title: string; hint: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-3 text-start transition-all duration-200 disabled:opacity-50",
        active ? "border-primary bg-secondary shadow-xs ring-2 ring-primary/15" : "hover:border-foreground/25 hover:bg-accent",
      )}
    >
      <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>
    </button>
  );
}

function DesignEditor({ design, onChange, onReset }: { design: PageDesign; onChange: (design: PageDesign) => void; onReset: () => void }) {
  const patch = (next: Partial<PageDesign>) => onChange({ ...design, ...next });

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-3 animate-in fade-in-0 slide-in-from-top-1 duration-300">
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{t.palettes}</p>
        <div className="grid grid-cols-3 gap-2">
          {PALETTES.map((palette) => (
            <button
              key={palette.key}
              type="button"
              onClick={() => patch({ colors: { ...palette.colors } })}
              aria-label={t.paletteNames[palette.key as keyof typeof t.paletteNames]}
              title={t.paletteNames[palette.key as keyof typeof t.paletteNames]}
              className="group overflow-hidden rounded-lg border transition-transform hover:-translate-y-0.5 hover:shadow-sm"
            >
              <span className="flex h-8">
                {(["primary", "accent", "secondary", "background"] as const).map((key) => (
                  <span key={key} className="flex-1" style={{ background: palette.colors[key] }} />
                ))}
              </span>
              <span className="block bg-card py-1 text-[11px] text-muted-foreground group-hover:text-foreground">{t.paletteNames[palette.key as keyof typeof t.paletteNames]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-muted-foreground">{ar.identities.sections.colors}</p>
        {COLOR_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <label htmlFor={`pd-${key}`} className="shrink-0 text-sm">
              {ar.identities.colors[key]}
            </label>
            <div className="w-40">
              <ColorInput id={`pd-${key}`} value={design.colors[key] ?? ""} onChange={(value) => value && patch({ colors: { ...design.colors, [key]: value } })} />
            </div>
          </div>
        ))}
      </div>

      {(["font_heading", "font_body"] as const).map((key) => (
        <FormField key={key} label={key === "font_heading" ? ar.identities.fields.headingFont : ar.identities.fields.bodyFont} htmlFor={`pd-${key}`}>
          <Select id={`pd-${key}`} value={design[key]} onChange={(event) => patch({ [key]: event.target.value })} options={FONT_KEYS.map((font) => ({ value: font, label: FONTS[font].label }))} />
          <p className="truncate rounded-md bg-card px-2 py-1.5 text-sm" style={{ fontFamily: fontStack(design[key]) }}>
            {ar.identities.fontSample}
          </p>
        </FormField>
      ))}

      <FormField label={ar.identities.fields.buttonRadius}>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={ar.identities.fields.buttonRadius}>
          {BUTTON_RADII.map((radius) => (
            <button
              key={radius}
              type="button"
              role="radio"
              aria-checked={design.button_radius === radius}
              aria-label={ar.identities.radius[radius]}
              title={ar.identities.radius[radius]}
              onClick={() => patch({ button_radius: radius })}
              className={cn("flex h-9 items-center justify-center rounded-md border transition-colors", design.button_radius === radius ? "border-primary bg-secondary" : "bg-card hover:bg-accent")}
            >
              <span className="h-3.5 w-7 border-2 border-primary" style={{ borderRadius: RADIUS_VALUES[radius] }} aria-hidden />
            </button>
          ))}
        </div>
      </FormField>

      <Button type="button" variant="ghost" size="sm" onClick={onReset} className="self-start">
        <RotateCcw />
        {t.reset}
      </Button>
    </div>
  );
}
