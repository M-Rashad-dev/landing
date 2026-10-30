import { hexToRgb, relativeLuminance } from "@/lib/color";
import type { IdentityColors } from "@/lib/types";

/** a mixed into b by `amount` (0..1), as #RRGGBB. */
export function mixHex(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const ch = (x: number, y: number) => Math.round(x * amount + y * (1 - amount)).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`.toUpperCase();
}

/**
 * Dark version of a store palette for night themes («ليالي»): the darker of background /
 * foreground becomes the page, the lighter one the text, deepened toward black so it reads as
 * night even when the identity's text color is a mid gray. Primary, its text and accent stay.
 */
export function nightColors(colors: IdentityColors): IdentityColors {
  const lightFirst = relativeLuminance(colors.background) >= relativeLuminance(colors.foreground);
  const dark = lightFirst ? colors.foreground : colors.background;
  const light = lightFirst ? colors.background : colors.foreground;
  const background = mixHex("#05060A", dark, 0.55);
  return {
    ...colors,
    background,
    foreground: light,
    muted: mixHex(light, background, 0.66),
    border: mixHex(light, background, 0.14),
    secondary: mixHex(colors.primary, background, 0.22),
  };
}
