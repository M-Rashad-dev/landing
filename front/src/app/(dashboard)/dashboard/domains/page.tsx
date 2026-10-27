import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { DomainsManager } from "./domains-manager";

export const metadata: Metadata = { title: ar.nav.domains };

export default function DomainsPage() {
  return (
    <>
      <PageHeader title={ar.nav.domains} description={ar.domains.subtitle} />
      <DomainsManager />
    </>
  );
}
