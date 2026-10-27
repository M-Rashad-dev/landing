import { redirect } from "next/navigation";
import { AppRoot } from "@/components/app-root";
import { SessionProvider } from "@/components/dashboard/session-context";
import { getSession } from "@/lib/auth/session";

/** Print screens (invoices): same session as the dashboard, no sidebar or top bar. */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role === "super_admin") redirect("/admin");

  return (
    <AppRoot>
      <SessionProvider session={session}>{children}</SessionProvider>
    </AppRoot>
  );
}
