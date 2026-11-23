import type { Metadata } from "next";
import { ActivityPage } from "@/features/settings/activity-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.staff.activity };

export default function Page() {
  return <ActivityPage />;
}
