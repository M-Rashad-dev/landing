import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Panel } from "@/components/ui/panel";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { getSession } from "@/lib/auth/session";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.auth.admin.title };

/** Placeholder until the admin dashboard part (after the store owner dashboard, HANDOFF.md). */
export default async function AdminHome() {
  const session = await getSession();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-bg px-4">
      <Logo />
      <Panel className="w-full max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-bold">{ar.auth.admin.title}</h1>
        <p className="mt-1 text-sm font-semibold text-ink-2">{session.user.name}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">{ar.auth.admin.text}</p>
        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </Panel>
    </div>
  );
}
