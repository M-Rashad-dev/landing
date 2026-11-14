import type { Metadata } from "next";
import { PlanEditorPage } from "@/features/admin/plan-editor";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.plans.editor.newTitle };

export default function Page() {
  return <PlanEditorPage planKey={null} />;
}
