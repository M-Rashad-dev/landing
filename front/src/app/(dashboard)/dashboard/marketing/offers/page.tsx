import type { Metadata } from "next";
import { Suspense } from "react";
import { OffersPage } from "@/features/promotions/offers/offers-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.promotions.offers.title };

export default function Page() {
  return (
    <Suspense>
      <OffersPage />
    </Suspense>
  );
}
