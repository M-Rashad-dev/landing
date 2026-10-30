import { ContactList, SocialLinks } from "@/themes/shared/components/contact-list";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { FooterProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { brandName, nonEmpty } from "@/themes/shared/utils";
import { ar } from "@/messages/ar";

/** «ليالي» footer: glowing columns, or a centered signature line. */
export function LayaliFooter({ props, variant, ctx }: SectionProps<FooterProps>) {
  const name = brandName(ctx, props.brand_text);
  const logo = ctx.identity.logo;
  const links = nonEmpty<{ label: string; link_url: string }>(props.links, "label");
  const year = new Date().getFullYear();
  const glowLine = <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, var(--c-primary), var(--c-accent), transparent)" }} aria-hidden />;
  const bottom = (
    <div className="t-muted mt-10 flex flex-col items-center gap-2 border-t l-line pt-6 text-center text-xs sm:flex-row sm:justify-between">
      <span>
        © {year} {name}
        {props.copyright_text ? ` — ${props.copyright_text}` : ""}
      </span>
      {props.show_platform_credit ? (
        <span>
          {ar.site.poweredBy} {ar.site.platform}
        </span>
      ) : null}
    </div>
  );
  const brand = (
    <div className="flex items-center gap-2">
      {logo ? <ResponsiveImage image={logo} sizes="120px" className="h-9 w-auto max-w-32 object-contain" alt={name} /> : null}
      <span className="t-heading l-grad-text text-xl font-bold">{name}</span>
    </div>
  );
  const linkList = (className: string) =>
    links.length ? (
      <ul className={className}>
        {links.map((link, i) => (
          <li key={i}>
            <SafeLink href={link.link_url} className="t-muted transition-colors hover:text-[var(--c-fg)]">
              {link.label}
            </SafeLink>
          </li>
        ))}
      </ul>
    ) : null;

  if (variant === "signature") {
    return (
      <footer className="relative px-4 pb-8 pt-4">
        {glowLine}
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 pt-12 text-center">
          {brand}
          {props.about ? <p className="t-muted max-w-xl text-sm leading-relaxed">{props.about}</p> : null}
          {linkList("flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm")}
          {props.show_contact ? <ContactList ctx={ctx} className="items-center" itemClassName="t-muted" /> : null}
          {props.show_socials ? <SocialLinks ctx={ctx} className="justify-center" linkClassName="l-glass rounded-full" /> : null}
        </div>
        <div className="mx-auto max-w-3xl">{bottom}</div>
      </footer>
    );
  }

  return (
    <footer className="relative overflow-hidden px-4 pb-8 pt-4">
      {glowLine}
      <div className="mx-auto grid max-w-6xl gap-10 pt-14 md:grid-cols-3">
        <div className="flex flex-col gap-4">
          {brand}
          {props.about ? <p className="t-muted text-sm leading-relaxed">{props.about}</p> : null}
          {props.show_socials ? <SocialLinks ctx={ctx} linkClassName="l-glass rounded-full" /> : null}
        </div>
        {links.length ? (
          <div>
            <h3 className="mb-4 font-bold text-[var(--c-accent)]">{ar.site.links}</h3>
            {linkList("flex flex-col gap-2.5 text-sm")}
          </div>
        ) : (
          <div className="hidden md:block" />
        )}
        {props.show_contact ? (
          <div>
            <h3 className="mb-4 font-bold text-[var(--c-accent)]">{ar.site.contactUs}</h3>
            <ContactList ctx={ctx} itemClassName="t-muted hover:text-[var(--c-fg)]" />
          </div>
        ) : null}
      </div>
      <div className="mx-auto max-w-6xl">{bottom}</div>
    </footer>
  );
}
