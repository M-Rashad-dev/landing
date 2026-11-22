import type { Metadata } from "next";
import { MailPage } from "@/features/settings/mail-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.mail.title };

export default function Page() {
  return <MailPage />;
}
