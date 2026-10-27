import { Mail, MapPin, Phone } from "lucide-react";
import { formatPhoneLocal } from "@/lib/format/phone";
import { telHref, whatsappHref } from "@/lib/links";
import type { PageContext } from "@/themes/types";
import { socialsOf } from "@/themes/shared/utils";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SafeLink } from "./safe-link";
import { SocialIcon } from "./social-icons";

/** Identity contact rows (empty keys hidden). */
export function ContactList({ ctx, className, itemClassName }: { ctx: PageContext; className?: string; itemClassName?: string }) {
  const { phone, whatsapp, email, address } = ctx.identity.contact;
  if (!phone && !whatsapp && !email && !address) return null;
  return (
    <ul className={cn("flex flex-col gap-2 text-sm", className)}>
      {phone ? (
        <li>
          <SafeLink href={telHref(phone)} className={cn("flex items-center gap-2", itemClassName)}>
            <Phone className="size-4" aria-hidden />
            <span dir="ltr">{formatPhoneLocal(phone)}</span>
          </SafeLink>
        </li>
      ) : null}
      {whatsapp ? (
        <li>
          <SafeLink href={whatsappHref(whatsapp)} className={cn("flex items-center gap-2", itemClassName)}>
            <SocialIcon network="whatsapp" width={16} height={16} />
            <span>{ar.site.whatsapp}</span>
          </SafeLink>
        </li>
      ) : null}
      {email ? (
        <li>
          <SafeLink href={`mailto:${email}`} className={cn("flex items-center gap-2", itemClassName)}>
            <Mail className="size-4" aria-hidden />
            <span dir="ltr">{email}</span>
          </SafeLink>
        </li>
      ) : null}
      {address ? (
        <li className={cn("flex items-center gap-2", itemClassName)}>
          <MapPin className="size-4" aria-hidden />
          <span>{address}</span>
        </li>
      ) : null}
    </ul>
  );
}

export function SocialLinks({ ctx, className, linkClassName }: { ctx: PageContext; className?: string; linkClassName?: string }) {
  const socials = socialsOf(ctx);
  if (socials.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {socials.map(({ network, url }) => (
        <li key={network}>
          <SafeLink href={url} ariaLabel={ar.site.socials[network]} className={cn("flex size-10 items-center justify-center", linkClassName)}>
            <SocialIcon network={network} />
          </SafeLink>
        </li>
      ))}
    </ul>
  );
}
