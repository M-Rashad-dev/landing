import { ContactList, SocialLinks } from "@/themes/shared/components/contact-list";
import { SafeLink } from "@/themes/shared/components/safe-link";
import type { FooterProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { brandName, nonEmpty } from "@/themes/shared/utils";
import { ar } from "@/messages/ar";

export function CeliaFooter({ props, variant, ctx }: SectionProps<FooterProps>) {
  const name = brandName(ctx, props.brand_text);
  const links = nonEmpty<{ label: string; link_url: string }>(props.links, "label");
  const year = new Date().getFullYear();
  const credit = props.show_platform_credit ? (
    <span>
      {ar.site.poweredBy} {ar.site.platform}
    </span>
  ) : null;

  if (variant === "minimal-line") {
    return (
      <footer className="t-bg border-t-[3px] t-line px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-sm md:flex-row md:justify-between">
          <span className="t-heading text-lg font-black uppercase">{name}</span>
          {links.length ? (
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 font-bold">
              {links.map((link, i) => (
                <li key={i}>
                  <SafeLink href={link.link_url} className="hover:underline">
                    {link.label}
                  </SafeLink>
                </li>
              ))}
            </ul>
          ) : null}
          {props.show_socials ? <SocialLinks ctx={ctx} linkClassName="border-2 t-line" /> : null}
          <span className="t-muted text-xs">
            © {year} {props.copyright_text} {credit}
          </span>
        </div>
      </footer>
    );
  }

  // dark-columns
  return (
    <footer className="t-inverse px-4 pb-8 pt-14">
      <div className="mx-auto max-w-6xl">
        <p className="t-heading mb-10 break-words text-5xl font-black uppercase leading-none tracking-tight md:text-7xl">{name}</p>
        <div className="grid gap-10 md:grid-cols-3">
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-black uppercase opacity-70">{ar.site.about}</h3>
            {props.about ? <p className="leading-relaxed opacity-85">{props.about}</p> : null}
            {props.show_socials ? <SocialLinks ctx={ctx} linkClassName="border-2 border-[var(--c-bg)]" /> : null}
          </div>
          {links.length ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black uppercase opacity-70">{ar.site.links}</h3>
              <ul className="flex flex-col gap-2 font-bold">
                {links.map((link, i) => (
                  <li key={i}>
                    <SafeLink href={link.link_url} className="hover:underline">
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
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black uppercase opacity-70">{ar.site.contactUs}</h3>
              <ContactList ctx={ctx} itemClassName="opacity-90 hover:opacity-100" />
            </div>
          ) : null}
        </div>
        <div className="mt-12 flex flex-col items-center gap-2 border-t-2 border-[var(--c-bg)] pt-6 text-xs opacity-70 md:flex-row md:justify-between">
          <span>
            © {year} {name}
            {props.copyright_text ? ` — ${props.copyright_text}` : ""}
          </span>
          {credit}
        </div>
      </div>
    </footer>
  );
}
