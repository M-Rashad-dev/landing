import { resolveColors } from "@/lib/identity/style";
import type { PageDesign, PublicIdentity } from "@/themes/types";

/**
 * The identity a page renders with: its saved identity, with the page-only design (if any)
 * replacing colors, fonts and button radius. Logo, contact, SEO and tracking stay from the identity.
 */
export function applyPageDesign<T extends Pick<PublicIdentity, "colors" | "font_heading" | "font_body" | "button_radius">>(identity: T, design: PageDesign | null | undefined): T {
  if (!design) return identity;
  return {
    ...identity,
    colors: resolveColors({ ...identity.colors, ...design.colors, primary_foreground: design.colors.primary_foreground }),
    font_heading: design.font_heading || identity.font_heading,
    font_body: design.font_body || identity.font_body,
    button_radius: design.button_radius || identity.button_radius,
  };
}

/** A complete page design copied from an identity (starting point of "custom for this page"). */
export function designFromIdentity(identity: Pick<PublicIdentity, "colors" | "font_heading" | "font_body" | "button_radius">): PageDesign {
  const { primary_foreground: _ignored, ...colors } = identity.colors;
  void _ignored;
  return { colors, font_heading: identity.font_heading, font_body: identity.font_body, button_radius: identity.button_radius };
}
