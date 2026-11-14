import type { Metadata } from "next";
import { ShippingPage } from "@/features/shipping/shipping-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.shipping.title };

export default function Page() {
  return <ShippingPage />;
}
