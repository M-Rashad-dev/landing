import type { Metadata } from "next";
import { DomainsPage } from "@/features/settings/domains-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.settings.domains.title };

export default function Page() {
  return (
    <DomainsPage />
  );
}
