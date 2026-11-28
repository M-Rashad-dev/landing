import type { Metadata } from "next";
import { Suspense } from "react";
import { QuestionsPage } from "@/features/questions/questions-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.questions.title };

export default function Page() {
  return (
    <Suspense>
      <QuestionsPage />
    </Suspense>
  );
}
