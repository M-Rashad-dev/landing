import type { Metadata } from "next";
import { AdminSettingsPage } from "@/features/admin/settings-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.settings.title };

export default function AdminSettings() {
  return <AdminSettingsPage />;
}
