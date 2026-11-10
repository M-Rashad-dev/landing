import type { Metadata } from "next";
import { ar } from "@/messages/ar";
import { PlanEditor } from "../plan-editor";

export const metadata: Metadata = { title: ar.admin.nav.plans };

export default async function EditPlanPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <PlanEditor planKey={decodeURIComponent(key)} />;
}
