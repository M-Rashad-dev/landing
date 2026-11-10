import { UsageMeter } from "@/components/billing/plan";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { PricePreview } from "@/components/shared/price-preview";
import { ar } from "@/messages/ar";
import { OffersManager } from "./offers-manager";

export const metadata: Metadata = { title: ar.offers.title };

export default function OffersPage() {
  return (
    <>
      <PageHeader title={ar.offers.title} description={ar.offers.description} actions={<UsageMeter limit="offers" />} />
      <div className="flex flex-col gap-8">
        <OffersManager />
        <PricePreview />
      </div>
    </>
  );
}
