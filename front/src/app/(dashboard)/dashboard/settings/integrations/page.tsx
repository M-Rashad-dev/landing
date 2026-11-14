import type { Metadata } from "next";
import { IntegrationsPage } from "@/features/settings/integrations-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.growth.integrations.title };

export default function Page() {
  return <IntegrationsPage />;
}
