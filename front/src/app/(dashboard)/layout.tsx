import type { Metadata } from "next";
import { BRAND_ICONS } from "@/config/brand";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PermissionGate } from "@/components/layout/permission-gate";
import { SessionProvider } from "@/lib/auth/session-context";
import { getSession } from "@/lib/auth/session";
import { storeUrl } from "@/lib/auth/store-url";
import { QueryProvider } from "@/lib/query";
import { serverEnv } from "@/lib/env";
import { RealtimeProvider } from "@/lib/realtime/realtime";
import { SupportWidget } from "@/features/support/support-widget";
import { CopilotButton, CopilotDrawer } from "@/features/copilot/copilot-drawer";
import { CopilotProvider } from "@/features/copilot/copilot-provider";

/** Store owner dashboard: a signed-in owner only (the platform admin has /admin). */
export const metadata: Metadata = { icons: BRAND_ICONS };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role === "super_admin") redirect("/admin");
  const url = storeUrl(session);
  // Staff: only what they were given (the owner: everything).
  const permissions = session.user.role === "staff" ? (session.user.permissions ?? []) : undefined;
  const allows = (key: string) => !permissions || permissions.includes(key);

  return (
    <SessionProvider value={{ user: session.user, tenant: session.tenant, plan: session.plan, store_name: session.store_name, storeUrl: url }}>
      <QueryProvider>
        <RealtimeProvider config={serverEnv().realtime}>
          <CopilotProvider>
            <AppShell
              userId={session.user.id}
              account={{ name: session.user.name, store: session.tenant?.name ?? "", storeUrl: url }}
              headerExtra={session.tenant && allows("copilot.use") ? <CopilotButton /> : null}
              sidePanel={session.tenant && allows("copilot.use") ? <CopilotDrawer userId={session.user.id} /> : null}
              permissions={permissions}
            >
              <PermissionGate permissions={permissions}>{children}</PermissionGate>
            </AppShell>
            {session.tenant && allows("support.use") ? <SupportWidget tenantId={session.tenant.id} /> : null}
          </CopilotProvider>
        </RealtimeProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
