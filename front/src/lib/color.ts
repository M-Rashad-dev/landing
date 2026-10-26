/** Color helpers (WCAG 2.x contrast). Colors are #RRGGBB. */

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = isHexColor(hex) ? hex.slice(1) : "000000";
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA for normal text. */
export function passesAA(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 4.5;
}

/** Black or white, whichever reads better on the background. */
export function readableOn(background: string): "#FFFFFF" | "#111111" {
  return contrastRatio("#FFFFFF", background) >= contrastRatio("#111111", background) ? "#FFFFFF" : "#111111";
}

/** rgba() string with the given alpha (0–1). */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}
