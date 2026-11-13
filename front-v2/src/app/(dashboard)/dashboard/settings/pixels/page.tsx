import type { Metadata } from "next";
import { PixelsPage } from "@/features/settings/pixels-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.growth.pixels.title };

export default function Page() {
  return <PixelsPage />;
}
