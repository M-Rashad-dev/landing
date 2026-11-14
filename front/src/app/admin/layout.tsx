import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import { getSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { QueryProvider } from "@/lib/query";
import { RealtimeProvider } from "@/lib/realtime/realtime";

/** Platform admin area: the super admin only (a store owner goes back to /dashboard). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role !== "super_admin") redirect("/dashboard");
  return (
    <QueryProvider>
      <RealtimeProvider config={serverEnv().realtime}>
        <AdminShell name={session.user.name}>{children}</AdminShell>
      </RealtimeProvider>
    </QueryProvider>
  );
}
