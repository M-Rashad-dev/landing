import { PlanGate } from "@/components/billing/plan";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { UpsellsManager } from "./upsells-manager";

export const metadata: Metadata = { title: ar.upsells.title };

export default function UpsellsPage() {
  return (
    <>
      <PageHeader title={ar.upsells.title} description={ar.upsells.description} />
      <PlanGate feature="upsells" label={ar.nav.upsells}>
        <UpsellsManager />
      </PlanGate>
    </>
  );
}
