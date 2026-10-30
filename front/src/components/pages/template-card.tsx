import { Dumbbell, Gamepad2, Gem, Shirt, Smartphone, Sofa, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { getTheme } from "@/themes/registry";
import type { PageTemplate, TemplateNiche } from "@/themes/templates";

const t = ar.templates;

export const NICHE_ICONS: Record<TemplateNiche, LucideIcon> = {
  fashion: Shirt,
  beauty: Sparkles,
  electronics: Smartphone,
  home: Sofa,
  kids: Gamepad2,
  health: Dumbbell,
  luxury: Gem,
};

/**
 * A template as a phone-shaped wireframe in its own colors: the theme's section thumbnails
 * stacked in page order, so the merchant sees the structure before choosing.
 */
export function TemplatePreview({ template, className }: { template: PageTemplate; className?: string }) {
  const theme = getTheme(template.themeKey);
  const { colors } = template.design;
  const visible = template.sections.filter((s) => s.type !== "sticky_cta").slice(0, 7);
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: `linear-gradient(160deg, ${colors.secondary}, ${colors.background})` }}>
      <div className="absolute inset-x-[24%] top-5 bottom-0 overflow-hidden rounded-t-[1.4rem] border-[6px] border-b-0 border-[#12152a] shadow-[0_20px_50px_-20px_rgba(18,21,42,.45)]" style={{ background: colors.background }}>
        <div className="flex flex-col gap-1.5 p-2" style={{ color: colors.primary }}>
          {visible.map((section, i) => {
            const Thumb = theme.components[section.type].Thumbnail;
            return (
              <div key={i} className="aspect-[120/72] w-full">
                <Thumb />
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute end-3 top-3 flex gap-1">
        {[colors.primary, colors.accent, colors.foreground].map((color) => (
          <span key={color} className="size-3.5 rounded-full ring-2 ring-white" style={{ background: color }} />
        ))}
      </div>
    </div>
  );
}

export function TemplateCard({ template, href, onSelect, selected = false }: { template: PageTemplate; href?: string; onSelect?: () => void; selected?: boolean }) {
  const niche = t.niches[template.niche];
  const Icon = NICHE_ICONS[template.niche];
  const theme = getTheme(template.themeKey);
  const body = (
    <>
      <TemplatePreview template={template} className="aspect-[4/3] border-b" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="flex items-center gap-2 text-base font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: template.design.colors.secondary, color: template.design.colors.primary }}>
            <Icon className="size-4" aria-hidden />
          </span>
          {niche.name}
        </p>
        <p className="text-sm text-muted-foreground">{niche.description}</p>
        <p className="mt-auto pt-1 text-xs text-muted-foreground">
          {t.theme(theme.name)} · {t.sections(template.sections.length)}
        </p>
      </div>
    </>
  );
  const cardClass = cn(
    "group flex flex-col overflow-hidden rounded-2xl border bg-card text-start shadow-sm transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md",
    selected && "border-primary ring-2 ring-primary/30",
  );

  if (onSelect) {
    return (
      <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={cardClass}>
        {body}
      </button>
    );
  }
  return (
    <div className={cardClass}>
      {body}
      {href ? (
        <div className="px-4 pb-4">
          <Button asChild className="w-full">
            <Link href={href}>{t.use}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
