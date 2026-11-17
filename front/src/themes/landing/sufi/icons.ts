import { Award, BadgeCheck, Crown, Droplet, Feather, Gem, Layers, Leaf, Palette, Ruler, Sparkles, Watch, type LucideIcon } from "lucide-react";
import { FEATURE_ICONS } from "@/themes/store/asas/icons";
import type { SufiIcon } from "./types";

/** The store icons plus the premium-product ones (keys: App\Themes\Landing\SufiLandingDesign::ICONS). */
export const SUFI_LANDING_ICONS: Record<SufiIcon, LucideIcon> = {
  ...FEATURE_ICONS,
  gem: Gem,
  crown: Crown,
  award: Award,
  feather: Feather,
  droplet: Droplet,
  sparkle: Sparkles,
  ruler: Ruler,
  layers: Layers,
  leaf: Leaf,
  palette: Palette,
  watch: Watch,
  badge: BadgeCheck,
};

export const SUFI_LANDING_ICON_KEYS = Object.keys(SUFI_LANDING_ICONS) as SufiIcon[];
