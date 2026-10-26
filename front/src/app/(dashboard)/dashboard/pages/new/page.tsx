import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { NewPageWizard } from "./wizard";

export const metadata: Metadata = { title: ar.pages.wizard.title };

export default function NewPagePage() {
  return (
    <>
      <PageHeader title={ar.pages.wizard.title} />
      <NewPageWizard />
    </>
  );
}
