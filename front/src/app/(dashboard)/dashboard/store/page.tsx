import type { Metadata } from "next";
import { PlanGate } from "@/components/billing/plan";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { StoreOverview } from "./store-overview";

export const metadata: Metadata = { title: ar.store.title };

export default function StorePage() {
  return (
    <>
      <PageHeader title={ar.store.title} description={ar.store.description} />
      <PlanGate feature="store" label={ar.store.title} replace>
        <StoreOverview />
      </PlanGate>
    </>
  );
}
