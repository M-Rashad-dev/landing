import { PageHeader } from "@/components/layout/page-header";
import { SettingsNav } from "@/features/settings/settings-nav";
import { ar } from "@/messages/ar";

/** «الإعدادات»: one header and the sub-page tabs. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title={ar.settings.title} className="mb-2" />
      <SettingsNav />
      {children}
    </>
  );
}
