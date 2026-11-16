import { Beef, Bike, ChefHat, Flame, Leaf, Soup, Sparkles, Thermometer, Timer, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { FEATURE_ICONS } from "@/themes/asas/icons";
import type { ShabeIcon } from "./types";

/** The store icons plus the kitchen ones (keys: App\Themes\ShabeDesign::ICONS). */
export const SHABE_ICONS: Record<ShabeIcon, LucideIcon> = {
  ...FEATURE_ICONS,
  flame: Flame,
  chef: ChefHat,
  leaf: Leaf,
  utensils: UtensilsCrossed,
  meat: Beef,
  timer: Timer,
  thermo: Thermometer,
  bike: Bike,
  soup: Soup,
  sparkle: Sparkles,
};

export const SHABE_ICON_KEYS = Object.keys(SHABE_ICONS) as ShabeIcon[];
