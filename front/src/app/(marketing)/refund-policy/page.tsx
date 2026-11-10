import type { Metadata } from "next";
import { ar } from "@/messages/ar";
import { LegalPage } from "../legal-page";
import { loadPublicPlans } from "../public-plans";

export const metadata: Metadata = { title: ar.legal.refund };

export default async function Page() {
  const data = await loadPublicPlans();
  return <LegalPage title={ar.legal.refund} paragraphs={ar.legal.refundBody} support={data?.support ?? null} />;
}
