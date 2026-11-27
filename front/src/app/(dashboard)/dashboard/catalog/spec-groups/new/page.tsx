import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupPage } from "@/features/catalog/specs/group-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.specs.group.newTitle };

export default function Page() {
  return (
    <Suspense>
      <GroupPage id={null} />
    </Suspense>
  );
}
