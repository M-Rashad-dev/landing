import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { PlanOverview } from "./plan-overview";

export const metadata: Metadata = { title: ar.billing.plan.title };

export default function PlanPage() {
  return (
    <>
      <PageHeader title={ar.billing.plan.title} description={ar.billing.plan.description} />
      <PlanOverview />
    </>
  );
}
