import type { Metadata } from "next";
import { MessagesPage } from "@/features/admin/messages-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.messages.title };

export default function Page() {
  return <MessagesPage />;
}
