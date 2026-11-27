import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupPage } from "@/features/catalog/specs/group-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.specs.groups.title };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <GroupPage id={Number(id)} />
    </Suspense>
  );
}
