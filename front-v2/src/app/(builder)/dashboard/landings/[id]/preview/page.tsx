import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPreview } from "@/features/landings/preview";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.landings.builder.preview };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <LandingPreview id={id} />;
}
