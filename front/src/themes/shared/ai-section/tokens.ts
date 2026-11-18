import { FONTS, type Colors, type FontKey, inkOn } from "@/themes/shared/design";
import type { AiTokens } from "./types";

const DEFAULT_COLORS: Colors = {
  primary: "#0b875b",
  secondary: "#ffc83d",
  background: "#ffffff",
  text: "#13261d",
};

type RawThemeSettings = {
  colors?: Partial<Colors>;
  colors_dark?: Partial<Colors>;
  font?: FontKey;
  display_font?: boolean;
  button?: "rounded" | "pill" | "square";
};

function resolveColors(raw?: Partial<Colors>): Colors {
  return {
    primary: raw?.primary ?? DEFAULT_COLORS.primary,
    secondary: raw?.secondary ?? DEFAULT_COLORS.secondary,
    background: raw?.background ?? DEFAULT_COLORS.background,
    text: raw?.text ?? DEFAULT_COLORS.text,
  };
}

function resolveFontFamily(font?: FontKey): string {
  const entry = font && FONTS[font] ? FONTS[font] : FONTS.cairo;
  return `"${entry.family}", sans-serif`;
}

export function buildAiTokens(opts: {
  colors: Colors;
  fontBody: string;
  fontDisplay?: string;
  radius: string;
}): AiTokens {
  const { colors, fontBody, fontDisplay, radius } = opts;
  return {
    primary: colors.primary,
    secondary: colors.secondary,
    bg: colors.background,
    text: colors.text,
    onPrimary: inkOn(colors.primary),
    muted: "color-mix(in srgb, var(--ai-text) 65%, transparent)",
    border: "color-mix(in srgb, var(--ai-text) 15%, transparent)",
    fontBody,
    fontDisplay: fontDisplay ?? fontBody,
    radius,
  };
}

export function asasAiTokens(settings: unknown): AiTokens {
  const s = (settings ?? {}) as RawThemeSettings;
  const fontBody = resolveFontFamily(s.font);
  return buildAiTokens({
    colors: resolveColors(s.colors),
    fontBody,
    fontDisplay: fontBody,
    radius: "12px",
  });
}

export function sufiStoreAiTokens(settings: unknown, scheme: "light" | "dark" = "light"): AiTokens {
  const s = (settings ?? {}) as RawThemeSettings;
  const fontBody = resolveFontFamily(s.font);
  const colors = resolveColors(scheme === "dark" && s.colors_dark ? s.colors_dark : s.colors);
  return buildAiTokens({
    colors,
    fontBody,
    fontDisplay: `"Amiri", ${fontBody}`,
    radius: "4px",
  });
}

export function shabeStoreAiTokens(settings: unknown): AiTokens {
  const s = (settings ?? {}) as RawThemeSettings;
  const fontBody = resolveFontFamily(s.font);
  const fontDisplay = s.display_font !== false ? `"Lalezar", ${fontBody}` : fontBody;
  return buildAiTokens({
    colors: resolveColors(s.colors),
    fontBody,
    fontDisplay,
    radius: "18px",
  });
}

export function bidayaLandingAiTokens(settings: unknown): AiTokens {
  const s = (settings ?? {}) as RawThemeSettings;
  const fontBody = resolveFontFamily(s.font);
  return buildAiTokens({
    colors: resolveColors(s.colors),
    fontBody,
    fontDisplay: fontBody,
    radius: "12px",
  });
}

export function shabeLandingAiTokens(settings: unknown): AiTokens {
  const s = (settings ?? {}) as RawThemeSettings;
  const fontBody = resolveFontFamily(s.font);
  const fontDisplay = s.display_font !== false ? `"Lalezar", ${fontBody}` : fontBody;
  return buildAiTokens({
    colors: resolveColors(s.colors),
    fontBody,
    fontDisplay,
    radius: "18px",
  });
}

export function sufiLandingAiTokens(settings: unknown, scheme: "light" | "dark" = "light"): AiTokens {
  const s = (settings ?? {}) as RawThemeSettings;
  const fontBody = resolveFontFamily(s.font);
  const colors = resolveColors(scheme === "dark" && s.colors_dark ? s.colors_dark : s.colors);
  const fontDisplay = s.display_font !== false ? `"Amiri", ${fontBody}` : fontBody;
  return buildAiTokens({
    colors,
    fontBody,
    fontDisplay,
    radius: "4px",
  });
}

export function aiTokensToCssVars(tokens: AiTokens): Record<string, string> {
  return {
    "--ai-primary": tokens.primary,
    "--ai-secondary": tokens.secondary,
    "--ai-bg": tokens.bg,
    "--ai-text": tokens.text,
    "--ai-on-primary": tokens.onPrimary,
    "--ai-muted": tokens.muted,
    "--ai-border": tokens.border,
    "--ai-font-body": tokens.fontBody,
    "--ai-font-display": tokens.fontDisplay,
    "--ai-radius": tokens.radius,
  };
}
