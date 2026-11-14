import type { Metadata } from "next";
import { ConfirmQueue } from "@/features/orders/confirm-queue";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.orders.queue.title };

export default function Page() {
  return <ConfirmQueue />;
}
