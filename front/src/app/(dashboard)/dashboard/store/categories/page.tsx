import type { Metadata } from "next";
import { PlanGate } from "@/components/billing/plan";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { CategoriesManager } from "./categories-manager";

export const metadata: Metadata = { title: ar.store.categories.title };

export default function StoreCategoriesPage() {
  return (
    <>
      <PageHeader title={ar.store.categories.title} description={ar.store.categories.description} />
      <PlanGate feature="store" label={ar.store.title} replace>
        <CategoriesManager />
      </PlanGate>
    </>
  );
}
