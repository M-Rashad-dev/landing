import { MobileMenu } from "@/themes/shared/components/mobile-menu";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { HeaderProps } from "@/themes/shared/schemas";
import type { PageContext, SectionProps } from "@/themes/types";
import { brandName, logoOf, nonEmpty } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";

function Brand({ props, ctx, className }: { props: HeaderProps; ctx: PageContext; className?: string }) {
  const logo = props.show_logo ? logoOf(ctx, props.logo_media_id) : null;
  const name = brandName(ctx, props.brand_text);
  return (
    <a href="#" className={cn("flex min-w-0 items-center gap-2", className)} aria-label={name}>
      {logo ? <ResponsiveImage image={logo} sizes="160px" priority className="h-10 w-auto max-w-40 object-contain" alt={name} /> : null}
      {!logo || props.brand_text ? <span className="t-heading truncate text-lg font-bold">{name}</span> : null}
    </a>
  );
}

function Cta({ props, className }: { props: HeaderProps; className?: string }) {
  if (!props.cta_enabled || !props.cta_label?.trim()) return null;
  return (
    <SafeLink href={props.cta_url || "#order"} className={cn("t-primary t-btn inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold shadow-sm transition-transform hover:-translate-y-0.5", className)}>
      {props.cta_label}
    </SafeLink>
  );
}

function Links({ props, className, linkClassName }: { props: HeaderProps; className?: string; linkClassName?: string }) {
  const links = nonEmpty<{ label: string; link_url: string }>(props.links, "label");
  if (links.length === 0) return null;
  return (
    <ul className={className}>
      {links.map((link, i) => (
        <li key={i}>
          <SafeLink href={link.link_url} className={cn("t-muted text-sm font-medium transition-colors hover:text-[var(--c-primary)]", linkClassName)}>
            {link.label}
          </SafeLink>
        </li>
      ))}
    </ul>
  );
}

function Announcement({ props }: { props: HeaderProps }) {
  if (!props.announcement_enabled || !props.announcement_text?.trim()) return null;
  return (
    <div className="px-4 py-2 text-center text-xs font-semibold sm:text-sm" style={{ background: props.announcement_color || "var(--c-primary)", color: props.announcement_color ? "#fff" : "var(--c-primary-fg)" }}>
      {props.announcement_text}
    </div>
  );
}

export function MalakHeader({ props, variant, ctx }: SectionProps<HeaderProps>) {
  const mobile = (
    <MobileMenu className="md:hidden" panelClassName="rounded-e-3xl">
      <Links props={props} className="flex flex-col gap-4" linkClassName="text-lg" />
      <Cta props={props} className="mt-6 w-full" />
    </MobileMenu>
  );

  return (
    <header className={cn(props.sticky && "sticky top-0 z-40")}>
      <Announcement props={props} />
      <div className="border-b t-border backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--c-bg) 88%, transparent)" }}>
        {variant === "logo-start" ? (
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:h-20">
            <Brand props={props} ctx={ctx} />
            <Links props={props} className="mx-auto hidden items-center gap-8 md:flex" />
            <Cta props={props} className="hidden rounded-full md:inline-flex" />
            <div className="ms-auto md:hidden">{mobile}</div>
          </div>
        ) : (
          <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:h-20">
            <div className="flex items-center">
              {mobile}
              <Links props={props} className="hidden items-center gap-6 md:flex" />
            </div>
            <Brand props={props} ctx={ctx} className="justify-center" />
            <div className="flex justify-end">
              <Cta props={props} className="px-4 py-2 md:px-5 md:py-2.5" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
