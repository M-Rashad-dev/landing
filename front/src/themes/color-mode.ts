/**
 * Themes drawn on a dark page made from the store's own colors (see lib/identity/night.ts).
 * Kept apart from the registry so IdentityStyle does not pull every theme component in.
 */
const NIGHT_THEMES = new Set(["layali"]);

export function isNightTheme(themeKey: string | null | undefined): boolean {
  return Boolean(themeKey && NIGHT_THEMES.has(themeKey));
}
