import type { Metadata } from "next";
import { ar } from "@/messages/ar";
import { LegalPage } from "../legal-page";
import { loadPublicPlans } from "../public-plans";

export const metadata: Metadata = { title: ar.legal.privacy };

export default async function Page() {
  const data = await loadPublicPlans();
  return <LegalPage title={ar.legal.privacy} paragraphs={ar.legal.privacyBody} support={data?.support ?? null} />;
}
