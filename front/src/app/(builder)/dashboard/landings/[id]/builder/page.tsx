import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingBuilder } from "@/features/landings/builder";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.landings.title };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <LandingBuilder id={id} />;
}
