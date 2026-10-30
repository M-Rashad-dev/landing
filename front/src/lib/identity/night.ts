import { contrastRatio, hexToRgb, relativeLuminance } from "@/lib/color";
import type { IdentityColors } from "@/lib/types";

/** a mixed into b by `amount` (0..1), as #RRGGBB. */
export function mixHex(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const ch = (x: number, y: number) => Math.round(x * amount + y * (1 - amount)).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`.toUpperCase();
}

/** A background counts as dark enough for a night page below this luminance. */
const DARK_ENOUGH = 0.06;

/**
 * Night version of a store palette («ليالي»). Each color keeps its meaning:
 * - background: the merchant's background when it is already dark; otherwise a near-black tinted
 *   with the primary color (a light background is never turned into text, and text never into background);
 * - text: the merchant's text color when it reads well on that page, otherwise a soft white;
 * - muted: the merchant's when readable, otherwise mixed from text; border / secondary are mixed.
 */
export function nightColors(colors: IdentityColors): IdentityColors {
  const background = relativeLuminance(colors.background) < DARK_ENOUGH ? colors.background : mixHex(colors.primary, "#07080D", 0.08);
  const foreground = contrastRatio(colors.foreground, background) >= 7 ? colors.foreground : "#F5F4F0";
  const muted = contrastRatio(colors.muted, background) >= 4.5 ? colors.muted : mixHex(foreground, background, 0.66);
  return {
    ...colors,
    background,
    foreground,
    muted,
    border: mixHex(foreground, background, 0.14),
    secondary: mixHex(colors.primary, background, 0.22),
  };
}
