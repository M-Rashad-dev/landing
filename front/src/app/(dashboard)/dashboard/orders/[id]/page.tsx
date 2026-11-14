import type { Metadata } from "next";
import { OrderPage } from "@/features/orders/order-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.orders.title };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderPage id={Number(id)} />;
}
