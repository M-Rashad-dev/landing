import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { PricingView } from "./pricing-view";

export const metadata: Metadata = { title: ar.billing.pricing.title };

export default function PlansPage() {
  return (
    <>
      <PageHeader title={ar.billing.pricing.title} description={ar.billing.pricing.description} />
      <PricingView />
    </>
  );
}
