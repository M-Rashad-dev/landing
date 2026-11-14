import { redirect } from "next/navigation";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { getSession } from "@/lib/auth/session";
import { storeUrl } from "@/lib/auth/store-url";
import { QueryProvider } from "@/lib/query";

/** Full-screen store tools (the Builder and the preview): the owner's session, no dashboard chrome. */
export default async function BuilderLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role === "super_admin") redirect("/admin");

  return (
    <SessionProvider value={{ user: session.user, tenant: session.tenant, plan: session.plan, store_name: session.store_name, storeUrl: storeUrl(session) }}>
      <QueryProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
