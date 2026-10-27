import { ContactList, SocialLinks } from "@/themes/shared/components/contact-list";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { FooterProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { brandName, nonEmpty } from "@/themes/shared/utils";
import { ar } from "@/messages/ar";

export function MalakFooter({ props, variant, ctx }: SectionProps<FooterProps>) {
  const name = brandName(ctx, props.brand_text);
  const logo = ctx.identity.logo;
  const links = nonEmpty<{ label: string; link_url: string }>(props.links, "label");
  const year = new Date().getFullYear();
  const bottom = (
    <div className="t-muted mt-10 flex flex-col items-center gap-2 border-t t-border pt-6 text-center text-xs sm:flex-row sm:justify-between">
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
      <span className="t-heading text-lg font-bold">{name}</span>
    </div>
  );

  if (variant === "columns") {
    return (
      <footer className="t-tint px-4 pb-8 pt-16">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            {brand}
            {props.about ? <p className="t-muted text-sm leading-relaxed">{props.about}</p> : null}
            {props.show_socials ? <SocialLinks ctx={ctx} linkClassName="t-bg rounded-full shadow-sm" /> : null}
          </div>
          {links.length ? (
            <div>
              <h3 className="mb-3 font-bold">{ar.site.links}</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {links.map((link, i) => (
                  <li key={i}>
                    <SafeLink href={link.link_url} className="t-muted hover:text-[var(--c-primary)]">
                      {link.label}
                    </SafeLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="hidden md:block" />
          )}
          {props.show_contact ? (
            <div>
              <h3 className="mb-3 font-bold">{ar.site.contactUs}</h3>
              <ContactList ctx={ctx} itemClassName="t-muted hover:text-[var(--c-primary)]" />
            </div>
          ) : null}
        </div>
        <div className="mx-auto max-w-6xl">{bottom}</div>
      </footer>
    );
  }

  return (
    <footer className="t-tint px-4 pb-8 pt-14">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        {brand}
        {props.about ? <p className="t-muted max-w-xl text-sm leading-relaxed">{props.about}</p> : null}
        {links.length ? (
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            {links.map((link, i) => (
              <li key={i}>
                <SafeLink href={link.link_url} className="t-muted hover:text-[var(--c-primary)]">
                  {link.label}
                </SafeLink>
              </li>
            ))}
          </ul>
        ) : null}
        {props.show_contact ? <ContactList ctx={ctx} className="items-center" itemClassName="t-muted" /> : null}
        {props.show_socials ? <SocialLinks ctx={ctx} className="justify-center" linkClassName="t-bg rounded-full shadow-sm" /> : null}
      </div>
      <div className="mx-auto max-w-3xl">{bottom}</div>
    </footer>
  );
}
