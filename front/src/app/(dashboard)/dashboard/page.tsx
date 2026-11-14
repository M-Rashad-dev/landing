import type { Metadata } from "next";
import { Suspense } from "react";
import { HomePage } from "@/features/home/home-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.home.title };

export default function Page() {
  return (
    <Suspense>
      <HomePage />
    </Suspense>
  );
}
