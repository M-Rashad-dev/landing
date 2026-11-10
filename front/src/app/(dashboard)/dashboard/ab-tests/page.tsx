import { PlanGate, UsageMeter } from "@/components/billing/plan";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { AbTestsManager } from "./ab-tests-manager";

export const metadata: Metadata = { title: ar.abTests.title };

export default function AbTestsPage() {
  return (
    <>
      <PageHeader title={ar.abTests.title} description={ar.abTests.description} actions={<UsageMeter limit="ab_tests" />} />
      <PlanGate limit="ab_tests" label={ar.nav.abTests}>
        <AbTestsManager />
      </PlanGate>
    </>
  );
}
