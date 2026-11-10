import { PlanGate } from "@/components/billing/plan";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { AnalyticsDashboard } from "./analytics-dashboard";

export const metadata: Metadata = { title: ar.analytics.title };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title={ar.analytics.title} description={ar.analytics.description} />
      <PlanGate feature="advanced_analytics" label={ar.nav.analytics} replace>
        <AnalyticsDashboard />
      </PlanGate>
    </>
  );
}
