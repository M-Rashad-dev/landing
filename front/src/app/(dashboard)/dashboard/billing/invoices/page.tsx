import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { InvoicesList } from "./invoices-list";

export const metadata: Metadata = { title: ar.billing.invoices.title };

export default function InvoicesPage() {
  return (
    <>
      <PageHeader title={ar.billing.invoices.title} description={ar.billing.invoices.description} />
      <InvoicesList />
    </>
  );
}
