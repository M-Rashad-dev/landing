import { PlanGate } from "@/components/billing/plan";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { LeadsManager } from "./leads-manager";

export const metadata: Metadata = { title: ar.leads.title };

export default function LeadsPage() {
  return (
    <>
      <PageHeader title={ar.leads.title} description={ar.leads.description} />
      <PlanGate feature="abandoned_leads" label={ar.nav.leads}>
        <LeadsManager />
      </PlanGate>
    </>
  );
}
