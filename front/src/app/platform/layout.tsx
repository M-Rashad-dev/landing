import type { Metadata } from "next";
import { BRAND_ICONS } from "@/config/brand";

export const metadata: Metadata = { icons: BRAND_ICONS };

/** The platform's own site (marketing home and platform pages). */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return children;
}
