import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { PricePreview } from "@/components/shared/price-preview";
import { ar } from "@/messages/ar";
import { CodesManager } from "./codes-manager";

export const metadata: Metadata = { title: ar.codes.title };

export default function DiscountCodesPage() {
  return (
    <>
      <PageHeader title={ar.codes.title} description={ar.codes.description} />
      <div className="flex flex-col gap-8">
        <CodesManager />
        <PricePreview />
      </div>
    </>
  );
}
