import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { IntegrationsManager } from "./integrations-manager";

export const metadata: Metadata = { title: ar.integrations.title };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader title={ar.integrations.title} description={ar.integrations.description} />
      <IntegrationsManager />
    </>
  );
}
