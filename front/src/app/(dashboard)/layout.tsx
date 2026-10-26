import { redirect } from "next/navigation";
import { AppRoot } from "@/components/app-root";
import { SessionProvider } from "@/components/dashboard/session-context";
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome";
import { getSession } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role === "super_admin") redirect("/admin");

  return (
    <AppRoot>
      <SessionProvider session={session}>
        <DashboardChrome>{children}</DashboardChrome>
      </SessionProvider>
    </AppRoot>
  );
}
