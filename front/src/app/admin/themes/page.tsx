import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { ThemesManager } from "./themes-manager";

export const metadata: Metadata = { title: ar.admin.nav.themes };

export default function ThemesPage() {
  return (
    <>
      <PageHeader title={ar.admin.nav.themes} description={ar.admin.themes.description} />
      <ThemesManager />
    </>
  );
}
