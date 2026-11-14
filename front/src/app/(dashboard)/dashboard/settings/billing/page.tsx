import type { Metadata } from "next";
import { BillingPage } from "@/features/settings/billing-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.settings.billing.title };

export default function Page() {
  return (
    <BillingPage />
  );
}
