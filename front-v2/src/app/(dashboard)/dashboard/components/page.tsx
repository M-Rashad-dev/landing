import type { Metadata } from "next";
import { Suspense } from "react";
import { ShowcasePage } from "@/features/showcase/showcase-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.showcase.title };

export default function ComponentsPage() {
  // The table demo keeps its state in the URL (useSearchParams needs a Suspense boundary).
  return (
    <Suspense>
      <ShowcasePage />
    </Suspense>
  );
}
