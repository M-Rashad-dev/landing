import type { Metadata } from "next";
import { LandingsPage } from "@/features/landings/landings-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.landings.title };

export default function Page() {
  return <LandingsPage />;
}
