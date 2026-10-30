import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { TemplateGallery } from "./template-gallery";

export const metadata: Metadata = { title: ar.templates.title };

export default function TemplatesPage() {
  return (
    <>
      <PageHeader title={ar.templates.title} description={ar.templates.description} />
      <TemplateGallery />
    </>
  );
}
