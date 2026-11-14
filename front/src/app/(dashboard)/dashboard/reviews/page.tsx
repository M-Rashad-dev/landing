import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewsPage } from "@/features/reviews/reviews-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.reviews.title };

export default function Page() {
  return (
    <Suspense>
      <ReviewsPage />
    </Suspense>
  );
}
