import { FALLBACK_COMPONENTS } from "@/themes/_fallback";
import { celiaTheme } from "@/themes/celia/theme.config";
import { malakTheme } from "@/themes/malak/theme.config";
import { isComponentType, type ComponentType, type ThemeComponentDef, type ThemeDef } from "@/themes/types";

/** Registered themes. Adding a theme = new folder + one line here + a row in ThemeSeeder. */
export const THEMES: Record<string, ThemeDef> = {
  malak: malakTheme,
  celia: celiaTheme,
};

export const DEFAULT_THEME = "malak";

export function getTheme(key: string | null | undefined): ThemeDef {
  return (key && THEMES[key]) || THEMES[DEFAULT_THEME];
}

/** Component of a type in a theme; null for unknown types (callers skip them instead of crashing). */
export function getComponent(themeKey: string | null | undefined, type: string): ThemeComponentDef | null {
  if (!isComponentType(type)) return null;
  return getTheme(themeKey).components[type] ?? FALLBACK_COMPONENTS[type];
}

/** The variant to render: the requested one if the theme has it, otherwise the theme default. */
export function resolveVariant(themeKey: string | null | undefined, type: ComponentType, variant: string | null | undefined): string {
  const def = getTheme(themeKey).components[type];
  if (!def) return "default";
  return def.variants.some((v) => v.key === variant) ? (variant as string) : def.defaultVariant;
}
