import type { Metadata } from "next";
import { InvoiceView } from "@/features/orders/invoice-view";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.orders.invoice.title };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceView id={Number(id)} />;
}
