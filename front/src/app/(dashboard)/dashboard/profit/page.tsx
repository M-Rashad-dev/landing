import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfitPage } from "@/features/profit/profit-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.profit.title };

export default function Page() {
  return (
    <Suspense>
      <ProfitPage />
    </Suspense>
  );
}
