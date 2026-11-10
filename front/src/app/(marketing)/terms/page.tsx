import type { Metadata } from "next";
import { ar } from "@/messages/ar";
import { LegalPage } from "../legal-page";
import { loadPublicPlans } from "../public-plans";

export const metadata: Metadata = { title: ar.legal.terms };

export default async function Page() {
  const data = await loadPublicPlans();
  return <LegalPage title={ar.legal.terms} paragraphs={ar.legal.termsBody} support={data?.support ?? null} />;
}
