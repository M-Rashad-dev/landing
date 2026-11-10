import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/messages/ar";
import { InvoiceView } from "./invoice-view";

export const metadata: Metadata = { title: ar.billing.invoices.title };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) notFound();

  return <InvoiceView id={invoiceId} />;
}
