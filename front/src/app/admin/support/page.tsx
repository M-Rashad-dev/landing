import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportPage } from "@/features/admin/support-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.support.admin.title };

export default function Page() {
  return (
    <Suspense>
      <SupportPage />
    </Suspense>
  );
}
