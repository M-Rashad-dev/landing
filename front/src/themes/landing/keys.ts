/**
 * The landing themes the front end can draw (back end: App\Themes\Landing\LandingThemes). Kept
 * apart from the registry so server code (the public page loader) can read it without the themes.
 */
export const LANDING_THEME_KEYS = ["bidaya_landing", "shabe_landing", "sufi_landing"] as const;

export type LandingThemeKey = (typeof LANDING_THEME_KEYS)[number];

/** The free theme a page falls back to. */
export const DEFAULT_LANDING_THEME: LandingThemeKey = "bidaya_landing";
