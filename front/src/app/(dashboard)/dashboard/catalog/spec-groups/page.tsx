import type { Metadata } from "next";
import { SpecGroupsPage } from "@/features/catalog/specs/spec-groups-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.specs.groups.title };

export default function Page() {
  return <SpecGroupsPage />;
}
