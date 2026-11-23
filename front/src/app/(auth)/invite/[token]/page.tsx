import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteForm } from "@/features/auth/invite-form";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.staff.title, robots: { index: false, follow: false } };

/** The link a new staff member gets by email: he sets his password here. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9]{48}$/.test(token)) notFound();
  return <InviteForm token={token} />;
}
