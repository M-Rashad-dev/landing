import type { Metadata } from "next";
import { ActivityPage } from "@/features/admin/activity-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.activity.title };

export default function Page() {
  return <ActivityPage />;
}
