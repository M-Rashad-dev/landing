import type { Metadata } from "next";
import { AiWalletPage } from "@/features/settings/ai-wallet-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.settings.aiWallet.title };

export default function Page() {
  return <AiWalletPage />;
}
