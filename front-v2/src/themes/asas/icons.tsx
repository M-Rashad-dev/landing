import { Banknote, Clock, Gift, Headphones, Heart, Package, Phone, RotateCcw, ShieldCheck, Star, Tag, Truck, type LucideIcon } from "lucide-react";
import type { IconKey, Social } from "./types";

export const FEATURE_ICONS: Record<IconKey, LucideIcon> = {
  truck: Truck,
  cash: Banknote,
  return: RotateCcw,
  shield: ShieldCheck,
  support: Headphones,
  gift: Gift,
  star: Star,
  clock: Clock,
  tag: Tag,
  heart: Heart,
  package: Package,
  phone: Phone,
};

/** Social marks drawn simply (the icon set has no brand logos). */
export function SocialIcon({ network, className }: { network: Social; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;
  switch (network) {
    case "facebook":
      return (
        <svg {...common}>
          <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.9-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 3c-2.4 0-2.7 0-3.7.1-3.2.1-4.7 1.7-4.9 4.9C3.4 9 3.3 9.3 3.3 12s0 3 .1 4c.1 3.2 1.7 4.7 4.9 4.9 1 0 1.3.1 3.7.1s2.7 0 3.7-.1c3.2-.1 4.7-1.7 4.9-4.9.1-1 .1-1.3.1-4s0-3-.1-4c-.1-3.2-1.7-4.7-4.9-4.9-1-.1-1.3-.1-3.7-.1zm0 1.6c2.4 0 2.6 0 3.6.1 2.3.1 3.3 1.2 3.4 3.4.1.9.1 1.2.1 3.6s0 2.6-.1 3.6c-.1 2.2-1.1 3.3-3.4 3.4-.9 0-1.2.1-3.6.1s-2.7 0-3.6-.1c-2.3-.1-3.3-1.2-3.4-3.4 0-.9-.1-1.2-.1-3.6s0-2.6.1-3.6c.1-2.2 1.1-3.3 3.4-3.4.9-.1 1.2-.1 3.6-.1z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M16.6 3h-3v11.6a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V8.9a5.8 5.8 0 1 0 4.9 5.7V9a7 7 0 0 0 4 1.3V7.3A4.1 4.1 0 0 1 16.6 3z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M17.7 3h3.1l-6.8 7.7L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.7 3h6.4l4.4 5.9L17.7 3zm-1.1 16.2h1.7L7.2 4.7H5.4l11.2 14.5z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" />
        </svg>
      );
    case "snapchat":
      return (
        <svg {...common}>
          <path d="M12 2.8c2.6 0 4.7 2 4.7 4.7v2.2l1.4-.4c.6-.1 1 .6.5 1-.5.4-1.2.7-1.8.9.4 1.6 1.7 3 3.3 3.6.4.2.4.7 0 .9-.6.3-1.3.4-2 .5l-.3 1c-.1.3-.4.4-.7.3-.6-.2-1.3-.2-1.9 0-.9.4-1.7 1.2-3.2 1.2s-2.3-.8-3.2-1.2c-.6-.2-1.3-.2-1.9 0-.3.1-.6 0-.7-.3l-.3-1c-.7-.1-1.4-.2-2-.5-.4-.2-.4-.7 0-.9 1.6-.6 2.9-2 3.3-3.6-.6-.2-1.3-.5-1.8-.9-.5-.4-.1-1.1.5-1l1.4.4V7.5c0-2.7 2.1-4.7 4.7-4.7z" />
        </svg>
      );
  }
}
