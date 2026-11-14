import type { Metadata } from "next";
import { PlansPage } from "@/features/admin/plans-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.plans.title };

export default function Page() {
  return <PlansPage />;
}
