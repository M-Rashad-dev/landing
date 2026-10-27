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
      {logo ? <ResponsiveImage image={logo} sizes="160px" priority className="h-10 w-auto max-w-40 object-contain" alt={name} /> : null}
      {!logo || props.brand_text ? <span className="t-heading truncate text-xl font-extrabold uppercase tracking-tight">{name}</span> : null}
    </a>
  );
}

function Cta({ props, className }: { props: HeaderProps; className?: string }) {
  if (!props.cta_enabled || !props.cta_label?.trim()) return null;
  return (
    <SafeLink href={props.cta_url || "#order"} className={cn("t-primary t-btn t-hard-sm t-press inline-flex items-center justify-center px-5 py-2 text-sm font-extrabold", className)}>
      {props.cta_label}
    </SafeLink>
  );
}

function Announcement({ props }: { props: HeaderProps }) {
  if (!props.announcement_enabled || !props.announcement_text?.trim()) return null;
  const text = props.announcement_text;
  return (
    <div className="overflow-hidden whitespace-nowrap border-b-2 t-line py-2 text-sm font-bold" style={{ background: props.announcement_color || "var(--c-accent)", color: props.announcement_color ? "#fff" : "#111" }} aria-label={text}>
      <div className="t-marquee gap-12" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>★ {text}</span>
        ))}
      </div>
    </div>
  );
}

export function CeliaHeader({ props, variant, ctx }: SectionProps<HeaderProps>) {
  const links = nonEmpty<{ label: string; link_url: string }>(props.links, "label");
  const menuLinks = (big: boolean) => (
    <ul className={cn("flex flex-col", big ? "gap-6" : "gap-4")}>
      {links.map((link, i) => (
        <li key={i}>
          <SafeLink href={link.link_url} className={cn("t-heading font-extrabold uppercase", big ? "text-4xl" : "text-xl")}>
            {link.label}
          </SafeLink>
        </li>
      ))}
    </ul>
  );

  return (
    <header className={cn(props.sticky && "sticky top-0 z-40")}>
      <Announcement props={props} />
      <div className="t-bg border-b-[3px] t-line">
        {variant === "minimal" ? (
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
            <Brand props={props} ctx={ctx} />
            <div className="flex items-center gap-3">
              <Cta props={props} className="hidden sm:inline-flex" />
              <MobileMenu overlay buttonClassName="t-hard-sm" panelClassName="justify-center">
                {menuLinks(true)}
                <Cta props={props} className="mt-10 w-full py-4 text-lg" />
              </MobileMenu>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:h-[72px]">
            <Brand props={props} ctx={ctx} />
            {links.length ? (
              <ul className="mx-auto hidden items-center gap-8 md:flex">
                {links.map((link, i) => (
                  <li key={i}>
                    <SafeLink href={link.link_url} className="text-sm font-extrabold uppercase tracking-wide underline-offset-8 hover:underline">
                      {link.label}
                    </SafeLink>
                  </li>
                ))}
              </ul>
            ) : null}
            <Cta props={props} className="ms-auto hidden md:inline-flex" />
            <MobileMenu className="ms-auto md:hidden" buttonClassName="t-hard-sm">
              {menuLinks(false)}
              <Cta props={props} className="mt-8 w-full py-3" />
            </MobileMenu>
          </div>
        )}
      </div>
    </header>
  );
}
