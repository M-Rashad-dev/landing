import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { NewPageWizard } from "./wizard";

export const metadata: Metadata = { title: ar.pages.wizard.title };

export default async function NewPagePage({ searchParams }: { searchParams: Promise<{ template?: string; theme?: string }> }) {
  const { template, theme } = await searchParams;
  return (
    <>
      <PageHeader title={ar.pages.wizard.title} />
      <NewPageWizard initialTemplate={template ?? null} initialTheme={typeof theme === "string" && /^[a-z0-9_-]{1,40}$/.test(theme) ? theme : null} />
    </>
  );
}
