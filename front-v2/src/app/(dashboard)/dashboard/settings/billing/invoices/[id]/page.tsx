import type { Metadata } from "next";
import { InvoicePage } from "@/features/settings/invoice-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.settings.billing.invoices };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoicePage id={Number(id)} />;
}
