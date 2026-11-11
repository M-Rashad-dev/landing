import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth/session";
import { storeUrl } from "@/lib/auth/store-url";

/** Store owner dashboard: a signed-in owner only (the platform admin has /admin). */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role === "super_admin") redirect("/admin");

  return <AppShell account={{ name: session.user.name, store: session.tenant?.name ?? "", storeUrl: storeUrl(session) }}>{children}</AppShell>;
}
