import type { Metadata } from "next";
import { AccountPage } from "@/features/settings/account-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.settings.account.title };

export default function Page() {
  return (
    <AccountPage />
  );
}
