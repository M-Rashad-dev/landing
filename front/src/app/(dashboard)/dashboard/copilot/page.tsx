import type { Metadata } from "next";
import { CopilotPage } from "@/features/copilot/copilot-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.copilot.pageTitle };

export default function Page() {
  return <CopilotPage />;
}
