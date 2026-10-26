import { Hourglass } from "lucide-react";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";
import { ar } from "@/messages/ar";

export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={Hourglass} title={ar.common.comingSoon} description={ar.common.comingSoonText} />
    </>
  );
}
