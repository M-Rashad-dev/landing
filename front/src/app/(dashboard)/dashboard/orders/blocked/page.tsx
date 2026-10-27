import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { BlockedManager } from "./blocked-manager";

export const metadata: Metadata = { title: ar.orders.blockedPage.title };

export default function BlockedPage() {
  return (
    <>
      <PageHeader title={ar.orders.blockedPage.title} description={ar.orders.blockedPage.description} />
      <BlockedManager />
    </>
  );
}
