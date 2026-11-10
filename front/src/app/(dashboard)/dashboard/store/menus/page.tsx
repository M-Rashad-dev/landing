import type { Metadata } from "next";
import { PlanGate } from "@/components/billing/plan";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { MenusEditor } from "./menus-editor";

export const metadata: Metadata = { title: ar.store.menus.title };

export default function StoreMenusPage() {
  return (
    <>
      <PageHeader title={ar.store.menus.title} description={ar.store.menus.description} />
      <PlanGate feature="store" label={ar.store.title} replace>
        <MenusEditor />
      </PlanGate>
    </>
  );
}
