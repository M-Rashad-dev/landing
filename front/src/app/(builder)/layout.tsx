import "@/components/shared/dashboard-fonts";
import { redirect } from "next/navigation";
import { AppRoot } from "@/components/app-root";
import { SessionProvider } from "@/components/dashboard/session-context";
import { getSession } from "@/lib/auth/session";

/** Full-screen editor: same session as the dashboard, without the sidebar shell. */
export default async function BuilderLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role === "super_admin") redirect("/admin");

  return (
    <AppRoot>
      <SessionProvider session={session}>{children}</SessionProvider>
    </AppRoot>
  );
}
