import type { Metadata } from "next";
import { PlanGate } from "@/components/billing/plan";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { StorePagesManager } from "./store-pages-manager";

export const metadata: Metadata = { title: ar.store.pages.title };

export default function StorePagesPage() {
  return (
    <>
      <PageHeader title={ar.store.pages.title} description={ar.store.pages.description} />
      <PlanGate feature="store" label={ar.store.title} replace>
        <StorePagesManager />
      </PlanGate>
    </>
  );
}
