import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportPage } from "@/features/catalog/imports/import-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.imports.title };

export default function Page() {
  return (
    <Suspense>
      <ImportPage />
    </Suspense>
  );
}
