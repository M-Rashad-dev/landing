import { AppShell } from "@/components/layout/app-shell";
import { ar } from "@/messages/ar";

/**
 * Dashboard frame. Sign-in arrives with its part (HANDOFF.md, F2); until then the account menu
 * shows neutral placeholders and no page reads store data.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell account={{ name: ar.nav.accountPlaceholder, store: ar.nav.storePlaceholder }}>{children}</AppShell>;
}
