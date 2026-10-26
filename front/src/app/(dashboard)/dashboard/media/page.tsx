import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { MediaLibrary } from "./media-library";

export const metadata: Metadata = { title: ar.media.title };

export default function MediaPage() {
  return (
    <>
      <PageHeader title={ar.media.title} description={ar.media.description} />
      <MediaLibrary />
    </>
  );
}
