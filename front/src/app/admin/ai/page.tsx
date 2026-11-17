import type { Metadata } from "next";
import { AiPage } from "@/features/admin/ai-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.ai.title };

export default function AdminAi() {
  return <AiPage />;
}
