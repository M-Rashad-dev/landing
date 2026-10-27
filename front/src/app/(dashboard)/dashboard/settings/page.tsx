import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { PasswordForm, ProfileForm, StoreForm } from "./settings-forms";
import { WhatsappTemplateForm } from "./whatsapp-template-form";

export const metadata: Metadata = { title: ar.settings.title };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title={ar.settings.title} description={ar.settings.description} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <StoreForm />
          <ProfileForm />
        </div>
        <PasswordForm />
      </div>
      <div className="mt-6">
        <WhatsappTemplateForm />
      </div>
    </>
  );
}
