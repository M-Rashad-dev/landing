import type { Metadata } from "next";
import { MethodsPage } from "@/features/admin/methods-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.methods.title };

export default function Page() {
  return <MethodsPage />;
}
