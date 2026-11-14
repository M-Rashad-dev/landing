import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SessionProvider } from "@/lib/auth/session-context";
import { getSession } from "@/lib/auth/session";
import { storeUrl } from "@/lib/auth/store-url";
import { QueryProvider } from "@/lib/query";
import { serverEnv } from "@/lib/env";
import { RealtimeProvider } from "@/lib/realtime/realtime";
import { SupportWidget } from "@/features/support/support-widget";

/** Store owner dashboard: a signed-in owner only (the platform admin has /admin). */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role === "super_admin") redirect("/admin");
  const url = storeUrl(session);

  return (
    <SessionProvider value={{ user: session.user, tenant: session.tenant, plan: session.plan, store_name: session.store_name, storeUrl: url }}>
      <QueryProvider>
        <RealtimeProvider config={serverEnv().realtime}>
          <AppShell account={{ name: session.user.name, store: session.tenant?.name ?? "", storeUrl: url }}>{children}</AppShell>
          {session.tenant ? <SupportWidget tenantId={session.tenant.id} /> : null}
        </RealtimeProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
