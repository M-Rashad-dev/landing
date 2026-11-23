import type { Metadata } from "next";
import { StaffPage } from "@/features/settings/staff-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.staff.title };

export default function Page() {
  return <StaffPage />;
}
