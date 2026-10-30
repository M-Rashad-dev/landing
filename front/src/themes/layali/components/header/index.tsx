import { MobileMenu } from "@/themes/shared/components/mobile-menu";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { HeaderProps } from "@/themes/shared/schemas";
import type { PageContext, SectionProps } from "@/themes/types";
import { brandName, logoOf, nonEmpty } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";

function Brand({ props, ctx }: { props: HeaderProps; ctx: PageContext }) {
  const logo = props.show_logo ? logoOf(ctx, props.logo_media_id) : null;
  const name = brandName(ctx, props.brand_text);
  return (
    <a href="#" className="flex min-w-0 items-center gap-2" aria-label={name}>
      {logo ? <ResponsiveImage image={logo} sizes="160px" priority className="h-9 w-auto max-w-36 object-contain" alt={name} /> : null}
      {!logo || props.brand_text ? <span className="t-heading truncate text-lg font-bold tracking-wide">{name}</span> : null}
    </a>
  );
}

function Links({ props, className, linkClassName }: { props: HeaderProps; className?: string; linkClassName?: string }) {
  const links = nonEmpty<{ label: string; link_url: string }>(props.links, "label");
  if (links.length === 0) return null;
  return (
    <ul className={className}>
      {links.map((link, i) => (
        <li key={i}>
          <SafeLink href={link.link_url} className={cn("t-muted text-sm transition-colors hover:text-[var(--c-fg)]", linkClassName)}>
            {link.label}
          </SafeLink>
        </li>
      ))}
    </ul>
  );
}

function Cta({ props, className }: { props: HeaderProps; className?: string }) {
  if (!props.cta_enabled || !props.cta_label?.trim()) return null;
  return (
    <SafeLink href={props.cta_url || "#order"} className={cn("t-primary t-btn l-glow-btn inline-flex items-center justify-center px-5 py-2 text-sm font-bold", className)}>
      {props.cta_label}
    </SafeLink>
  );
}

/** «ليالي»: a floating glass bar, or a centered minimal header with a glowing line under it. */
export function LayaliHeader({ props, variant, ctx }: SectionProps<HeaderProps>) {
  const announcement =
    props.announcement_enabled && props.announcement_text?.trim() ? (
      <div className="px-4 py-2 text-center text-xs font-semibold tracking-wide sm:text-sm" style={{ background: props.announcement_color || "linear-gradient(90deg, var(--c-primary), var(--c-accent))", color: props.announcement_color ? "#fff" : "var(--c-primary-fg)" }}>
        {props.announcement_text}
      </div>
    ) : null;
  const mobile = (
    <MobileMenu className="md:hidden" panelClassName="l-glass">
      <Links props={props} className="flex flex-col gap-4" linkClassName="text-lg" />
      <Cta props={props} className="mt-6 w-full" />
    </MobileMenu>
  );

  if (variant === "centered-minimal") {
    return (
      <header className={cn(props.sticky && "sticky top-0 z-40")}>
        {announcement}
        <div className="relative backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--c-bg) 80%, transparent)" }}>
          <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:h-20">
            <div className="flex items-center">
              {mobile}
              <Links props={props} className="hidden items-center gap-6 md:flex" />
            </div>
            <Brand props={props} ctx={ctx} />
            <div className="flex justify-end">
              <Cta props={props} />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--c-primary), var(--c-accent), transparent)" }} aria-hidden />
        </div>
      </header>
    );
  }

  return (
    <header className={cn("px-3 pt-3", props.sticky && "sticky top-0 z-40")}>
      {announcement ? <div className="-mx-3 -mt-3 mb-3">{announcement}</div> : null}
      <div className="l-glass mx-auto flex h-14 max-w-6xl items-center gap-4 rounded-full ps-5 pe-2 md:h-16">
        <Brand props={props} ctx={ctx} />
        <Links props={props} className="mx-auto hidden items-center gap-7 md:flex" />
        <Cta props={props} className="hidden rounded-full md:inline-flex" />
        <div className="ms-auto md:hidden">{mobile}</div>
      </div>
    </header>
  );
}
