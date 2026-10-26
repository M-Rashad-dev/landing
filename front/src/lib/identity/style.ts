import { readableOn, isHexColor } from "@/lib/color";
import { fontStack } from "@/lib/fonts";
import type { ButtonRadius, IdentityColors } from "@/lib/types";

export const DEFAULT_COLORS: IdentityColors = {
  primary: "#7C3AED",
  primary_foreground: "#FFFFFF",
  secondary: "#F5F3FF",
  accent: "#F59E0B",
  background: "#FFFFFF",
  foreground: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
};

export const RADIUS_VALUES: Record<ButtonRadius, string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "14px",
  full: "9999px",
};

export const BUTTON_RADII: ButtonRadius[] = ["none", "sm", "md", "lg", "full"];

export type IdentityStyleInput = {
  colors: Partial<IdentityColors> | null | undefined;
  font_heading: string | null | undefined;
  font_body: string | null | undefined;
  button_radius: string | null | undefined;
};

/** Merge with defaults; primary_foreground falls back to the readable color on primary. */
export function resolveColors(colors: Partial<IdentityColors> | null | undefined): IdentityColors {
  const merged = { ...DEFAULT_COLORS };
  for (const key of Object.keys(DEFAULT_COLORS) as Array<keyof IdentityColors>) {
    const value = colors?.[key];
    if (isHexColor(value)) merged[key] = value.toUpperCase();
  }
  if (!isHexColor(colors?.primary_foreground)) merged.primary_foreground = readableOn(merged.primary);
  return merged;
}

/** CSS custom properties consumed by the themes (--c-*, --font-*, --btn-radius). */
export function identityCssVars(identity: IdentityStyleInput): Record<string, string> {
  const c = resolveColors(identity.colors);
  const radius = RADIUS_VALUES[(identity.button_radius as ButtonRadius) ?? "md"] ?? RADIUS_VALUES.md;
  return {
    "--c-primary": c.primary,
    "--c-primary-fg": c.primary_foreground,
    "--c-secondary": c.secondary,
    "--c-accent": c.accent,
    "--c-bg": c.background,
    "--c-fg": c.foreground,
    "--c-muted": c.muted,
    "--c-border": c.border,
    "--font-heading": fontStack(identity.font_heading),
    "--font-body": fontStack(identity.font_body),
    "--btn-radius": radius,
  };
}
