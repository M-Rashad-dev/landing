import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsPage } from "@/features/analytics/analytics-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.analytics.title };

export default function Page() {
  return (
    <Suspense>
      <AnalyticsPage />
    </Suspense>
  );
}
