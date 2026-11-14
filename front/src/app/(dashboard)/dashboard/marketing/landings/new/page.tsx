import type { Metadata } from "next";
import { ThemeGallery } from "@/features/landings/theme-gallery";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.landings.gallery.title };

export default function Page() {
  return <ThemeGallery />;
}
