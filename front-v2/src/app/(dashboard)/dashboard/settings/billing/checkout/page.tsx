import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPage } from "@/features/settings/checkout";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.settings.checkout.title };

export default function Page() {
  return (
    <Suspense>
      <CheckoutPage />
    </Suspense>
  );
}
