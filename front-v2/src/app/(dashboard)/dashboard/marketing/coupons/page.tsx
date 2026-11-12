import type { Metadata } from "next";
import { Suspense } from "react";
import { CouponsPage } from "@/features/promotions/coupons/coupons-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.promotions.coupons.title };

export default function Page() {
  return (
    <Suspense>
      <CouponsPage />
    </Suspense>
  );
}
