import { Award, Droplet, Feather, FlaskConical, Flower2, Gem, Hand, Leaf, Moon, Smile, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { FEATURE_ICONS } from "@/themes/store/asas/icons";
import type { RawaqIcon } from "./types";

/** The store icons plus the beauty ones (keys: App\Themes\Landing\RawaqLandingDesign::ICONS). */
export const RAWAQ_LANDING_ICONS: Record<RawaqIcon, LucideIcon> = {
  ...FEATURE_ICONS,
  droplet: Droplet,
  sparkle: Sparkles,
  leaf: Leaf,
  sun: Sun,
  moon: Moon,
  flask: FlaskConical,
  smile: Smile,
  feather: Feather,
  award: Award,
  gem: Gem,
  hand: Hand,
  flower: Flower2,
};
