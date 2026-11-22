import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/messages/ar";
import { PayView } from "@/themes/shared/pay-view";

type Props = { params: Promise<{ host: string; token: string }> };

export const metadata: Metadata = { title: { absolute: ar.storefront.pay.title }, robots: { index: false, follow: false } };

/** A prepaid order's pay page (the private link in the order messages): where to pay, and the receipt. */
export default async function PayPage({ params }: Props) {
  const { token } = await params;
  if (!/^[a-z0-9]{12}$/.test(token)) notFound();
  return <PayView token={token} />;
}
