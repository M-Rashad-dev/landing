import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { ShippingSettings } from "./shipping-settings";

export const metadata: Metadata = { title: ar.shipping.title };

export default function ShippingPage() {
  return (
    <>
      <PageHeader title={ar.shipping.title} description={ar.shipping.description} />
      <ShippingSettings />
    </>
  );
}
