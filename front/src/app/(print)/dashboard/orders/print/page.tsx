import type { Metadata } from "next";
import { ar } from "@/messages/ar";
import { InvoicesPrint } from "./invoices-print";

export const metadata: Metadata = { title: ar.orders.invoice.title };

/** /dashboard/orders/print?ids=1,2,3&size=a4|a6 */
export default async function PrintPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const ids = String(params.ids ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 100);
  const size = params.size === "a6" ? "a6" : "a4";

  return <InvoicesPrint ids={[...new Set(ids)]} initialSize={size} />;
}
