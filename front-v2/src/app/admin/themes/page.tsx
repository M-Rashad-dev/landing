import type { Metadata } from "next";
import { ThemesPage } from "@/features/admin/themes-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.themes.title };

export default function Page() {
  return <ThemesPage />;
}
