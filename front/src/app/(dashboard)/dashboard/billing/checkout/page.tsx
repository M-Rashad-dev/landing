import type { Metadata } from "next";
import { ar } from "@/messages/ar";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = { title: ar.billing.checkout.title };

/** Pay page of a plan period or a theme: a look only, the invoice is created with the receipt. */
export default function CheckoutPage() {
  return <CheckoutView />;
}
