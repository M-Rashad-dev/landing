import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { ConfirmationQueue } from "./confirmation-queue";

export const metadata: Metadata = { title: ar.orders.queue.title };

export default function ConfirmPage() {
  return (
    <>
      <PageHeader title={ar.orders.queue.title} description={ar.orders.queue.description} />
      <ConfirmationQueue />
    </>
  );
}
