import type { Metadata } from "next";
import { ar } from "@/messages/ar";
import { PlanEditor } from "../plan-editor";

export const metadata: Metadata = { title: ar.admin.plans.createTitle };

export default function NewPlanPage() {
  return <PlanEditor planKey={null} />;
}
