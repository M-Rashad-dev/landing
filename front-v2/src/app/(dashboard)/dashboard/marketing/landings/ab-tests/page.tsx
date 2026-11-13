import type { Metadata } from "next";
import { AbTestsPage } from "@/features/landings/ab-tests-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.growth.ab.title };

export default function Page() {
  return <AbTestsPage />;
}
