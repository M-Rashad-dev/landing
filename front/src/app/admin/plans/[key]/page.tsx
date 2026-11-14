import type { Metadata } from "next";
import { PlanEditorPage } from "@/features/admin/plan-editor";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.plans.title };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <PlanEditorPage planKey={decodeURIComponent(key)} />;
}
