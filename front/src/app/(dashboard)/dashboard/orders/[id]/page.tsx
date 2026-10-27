import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/messages/ar";
import { OrderDetails } from "./order-details";

export const metadata: Metadata = { title: ar.orders.title };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <OrderDetails id={Number(id)} />;
}
