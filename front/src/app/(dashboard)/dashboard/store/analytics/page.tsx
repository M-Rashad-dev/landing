import type { Metadata } from "next";
import { PlanGate } from "@/components/billing/plan";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { StoreAnalyticsDashboard } from "./store-analytics";

export const metadata: Metadata = { title: ar.store.analytics.title };

export default function StoreAnalyticsPage() {
  return (
    <>
      <PageHeader title={ar.store.analytics.title} description={ar.store.analytics.description} />
      <PlanGate feature="store" label={ar.store.title} replace>
        <StoreAnalyticsDashboard />
      </PlanGate>
    </>
  );
}
