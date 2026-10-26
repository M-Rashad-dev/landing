/**
 * The six identity fonts (keys match back/config/landing.php "fonts").
 * Files come from @fontsource packages bundled with the app — no external requests.
 */
export type FontKey = "cairo" | "tajawal" | "almarai" | "ibm_plex_arabic" | "noto_kufi" | "readex_pro";

export type FontDef = {
  key: FontKey;
  family: string;
  label: string;
  /** @fontsource package folder */
  pkg: string;
  weights: number[];
};

export const FONTS: Record<FontKey, FontDef> = {
  cairo: { key: "cairo", family: "Cairo", label: "Cairo — القاهرة", pkg: "cairo", weights: [400, 600, 700, 800] },
  tajawal: { key: "tajawal", family: "Tajawal", label: "Tajawal — تجوال", pkg: "tajawal", weights: [400, 500, 700, 800] },
  almarai: { key: "almarai", family: "Almarai", label: "Almarai — المراعي", pkg: "almarai", weights: [400, 700, 800] },
  ibm_plex_arabic: {
    key: "ibm_plex_arabic",
    family: "IBM Plex Sans Arabic",
    label: "IBM Plex Sans Arabic",
    pkg: "ibm-plex-sans-arabic",
    weights: [400, 500, 600, 700],
  },
  noto_kufi: { key: "noto_kufi", family: "Noto Kufi Arabic", label: "Noto Kufi — نوتو كوفي", pkg: "noto-kufi-arabic", weights: [400, 600, 700, 800] },
  readex_pro: { key: "readex_pro", family: "Readex Pro", label: "Readex Pro — ريدكس", pkg: "readex-pro", weights: [400, 500, 600, 700] },
};

export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

export function isFontKey(value: unknown): value is FontKey {
  return typeof value === "string" && value in FONTS;
}

export function fontDef(key: string | null | undefined): FontDef {
  return isFontKey(key) ? FONTS[key] : FONTS.cairo;
}

/** CSS font-family stack for a key. */
export function fontStack(key: string | null | undefined): string {
  return `"${fontDef(key).family}", system-ui, sans-serif`;
}

/** Subsets shipped for public pages (Arabic + basic Latin for numbers and brand names). */
export const FONT_SUBSETS = ["arabic", "latin"] as const;

/**
 * @font-face rules for the given fonts, pointing at files copied to /fonts by
 * scripts/copy-fonts.mjs. Only the fonts a page actually uses are emitted.
 */
export function getFontCss(keys: Array<string | null | undefined>): string {
  const unique = Array.from(new Set(keys.map((key) => fontDef(key).key)));
  const rules: string[] = [];

  for (const key of unique) {
    const def = FONTS[key];
    for (const weight of def.weights) {
      for (const subset of FONT_SUBSETS) {
        rules.push(
          `@font-face{font-family:"${def.family}";font-style:normal;font-display:swap;font-weight:${weight};` +
            `src:url(/fonts/${def.pkg}/${def.pkg}-${subset}-${weight}-normal.woff2) format("woff2");` +
            `unicode-range:${UNICODE_RANGES[subset]}}`,
        );
      }
    }
  }

  return rules.join("\n");
}

/** Path of the main (regular, Arabic) file to preload. */
export function fontPreloadHref(key: string | null | undefined): string {
  const def = fontDef(key);
  const weight = def.weights.includes(400) ? 400 : def.weights[0];
  return `/fonts/${def.pkg}/${def.pkg}-arabic-${weight}-normal.woff2`;
}

const UNICODE_RANGES: Record<(typeof FONT_SUBSETS)[number], string> = {
  arabic: "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC",
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
};
