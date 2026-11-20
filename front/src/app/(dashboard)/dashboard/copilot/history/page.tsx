import type { Metadata } from "next";
import { CopilotHistoryPage } from "@/features/copilot/history-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.copilot.history.title };

export default function Page() {
  return <CopilotHistoryPage />;
}
