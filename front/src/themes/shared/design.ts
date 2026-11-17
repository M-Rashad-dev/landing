/** What every theme shares, store and landing: fonts, colors, socials, image sizes. */

export type FontKey = "cairo" | "tajawal" | "almarai" | "ibm_plex_arabic" | "noto_kufi" | "readex_pro";
export type FontSize = "small" | "medium" | "large";
export type Social = "facebook" | "instagram" | "tiktok" | "x" | "youtube" | "snapchat";

export type Colors = { primary: string; secondary: string; background: string; text: string };

export type MediaUrls = Record<string, string>;

/** The best size of an image for a place (falls back to any size the image has). */
export function pick(urls: MediaUrls | null | undefined, size: "thumb" | "medium" | "large"): string | null {
  if (!urls) return null;
  return urls[size] ?? urls.large ?? urls.medium ?? urls.thumb ?? Object.values(urls)[0] ?? null;
}

export const FONTS: Record<FontKey, { label: string; family: string; google: string }> = {
  cairo: { label: "Cairo", family: "Cairo", google: "Cairo:wght@400;600;700;800" },
  tajawal: { label: "تجوال", family: "Tajawal", google: "Tajawal:wght@400;500;700;800" },
  almarai: { label: "Almarai", family: "Almarai", google: "Almarai:wght@400;700;800" },
  ibm_plex_arabic: { label: "IBM Plex Sans Arabic", family: "IBM Plex Sans Arabic", google: "IBM+Plex+Sans+Arabic:wght@400;500;600;700" },
  noto_kufi: { label: "Noto Kufi Arabic", family: "Noto Kufi Arabic", google: "Noto+Kufi+Arabic:wght@400;600;700;800" },
  readex_pro: { label: "Readex Pro", family: "Readex Pro", google: "Readex+Pro:wght@400;500;600;700" },
};

export const FONT_SCALE: Record<FontSize, number> = { small: 0.92, medium: 1, large: 1.1 };

/** Ready color sets (the first one is «نعناع», the default). */
export const PALETTES: Array<{ key: string; colors: Colors }> = [
  { key: "mint", colors: { primary: "#0b875b", secondary: "#ffc83d", background: "#ffffff", text: "#13261d" } },
  { key: "sea", colors: { primary: "#1d4ed8", secondary: "#f59e0b", background: "#ffffff", text: "#0f172a" } },
  { key: "rose", colors: { primary: "#db2777", secondary: "#fbbf24", background: "#fff7fb", text: "#3b0a24" } },
  { key: "coffee", colors: { primary: "#7c4a2d", secondary: "#e7b75f", background: "#fbf7f2", text: "#2b1b12" } },
  { key: "night", colors: { primary: "#a78bfa", secondary: "#f472b6", background: "#0f0f1a", text: "#f4f4f5" } },
  { key: "mono", colors: { primary: "#111827", secondary: "#ef4444", background: "#ffffff", text: "#111827" } },
];

export const SOCIALS: Social[] = ["facebook", "instagram", "tiktok", "x", "youtube", "snapchat"];

/** Text on a colored background: dark or light, whichever reads better. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#111111" : "#ffffff";
}
