import type { Metadata } from "next";
import { UpsellsPage } from "@/features/promotions/upsells/upsells-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.growth.upsells.title };

export default function Page() {
  return <UpsellsPage />;
}
