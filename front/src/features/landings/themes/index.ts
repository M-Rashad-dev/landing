import { DEFAULT_LANDING_THEME, LANDING_THEME_KEYS, type LandingThemeKey } from "@/themes/landing/keys";
import { bidayaBuilder } from "./bidaya";
import { rawaqBuilder } from "./rawaq";
import { shabeBuilder } from "./shabe";
import { sufiBuilder } from "./sufi";
import type { LandingBuilderTheme } from "./types";

export type { LandingBuilderTheme, LandingExtrasProps, LandingSection, LandingSectionFormProps } from "./types";

/** The Builder side of every landing theme by key (the same keys as the page registry). */
export const LANDING_BUILDER_THEMES: Record<LandingThemeKey, LandingBuilderTheme> = {
  bidaya_landing: bidayaBuilder,
  shabe_landing: shabeBuilder,
  sufi_landing: sufiBuilder,
  rawaq_landing: rawaqBuilder,
};

/** The Builder theme of a key (the free theme for a key the front end doesn't know). */
export function landingBuilderTheme(key: string): LandingBuilderTheme {
  return (LANDING_THEME_KEYS as readonly string[]).includes(key) ? LANDING_BUILDER_THEMES[key as LandingThemeKey] : LANDING_BUILDER_THEMES[DEFAULT_LANDING_THEME];
}
