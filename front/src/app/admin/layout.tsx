import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AppRoot } from "@/components/app-root";
import { SessionProvider } from "@/components/dashboard/session-context";
import { getSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role !== "super_admin") redirect("/dashboard");

  return (
    <AppRoot>
      <SessionProvider session={session}>
        <AdminChrome>{children}</AdminChrome>
      </SessionProvider>
    </AppRoot>
  );
}
