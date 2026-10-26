import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.nav.pages };

export default function Page() {
  return <ComingSoon title={ar.nav.pages} />;
}
