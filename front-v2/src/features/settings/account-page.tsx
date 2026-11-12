"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PasswordInput, PhoneInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { api } from "@/lib/api/client";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { formatPhone } from "@/lib/format";
import { zEmail, zPassword, zPhone, zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";

const t = ar.settings.account;

const profileSchema = z.object({ name: zRequiredString(100, 2), email: zEmail, phone: zPhone });
type Profile = z.infer<typeof profileSchema>;

const passwordSchema = z.object({ current_password: z.string().min(1, ar.validation.required), password: zPassword });
type Password = z.infer<typeof passwordSchema>;

export function AccountPage() {
  return (
    <div className="grid max-w-3xl gap-4">
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}

function ProfileForm() {
  const session = useSession();
  const router = useRouter();
  const user = session.user as { name: string; email: string; phone: string | null } | null;
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Profile>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ? formatPhone(user.phone) : "" } });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: Profile) {
    setFormError(null);
    try {
      await api("/dashboard/profile", { method: "PATCH", body: values });
      toast.success(t.saved);
      form.reset(values);
      router.refresh();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["name", "email", "phone"]);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <Panel>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <PanelHeader title={t.profile} />
        <PanelBody className="flex flex-col gap-3">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <Field label={t.name} htmlFor="acc-name" error={errors.name?.message} required>
            <Input id="acc-name" autoComplete="name" aria-invalid={!!errors.name} {...form.register("name")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.email} htmlFor="acc-email" error={errors.email?.message} required>
              <Input id="acc-email" type="email" dir="ltr" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
            </Field>
            <Field label={t.phone} htmlFor="acc-phone" error={errors.phone?.message} required>
              <Controller control={form.control} name="phone" render={({ field }) => <PhoneInput id="acc-phone" value={field.value} onChange={field.onChange} aria-invalid={!!errors.phone} />} />
            </Field>
          </div>
        </PanelBody>
        <PanelFooter>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}

function PasswordForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Password>({ resolver: zodResolver(passwordSchema), defaultValues: { current_password: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Password) {
    setFormError(null);
    try {
      // The back end asks for a confirmation: one field with a show/hide eye (owner decision).
      await api("/dashboard/profile/password", { method: "PUT", body: { ...values, password_confirmation: values.password } });
      toast.success(t.passwordSaved);
      form.reset();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["current_password", "password"]);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <Panel>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <PanelHeader title={t.password} />
        <PanelBody className="flex flex-col gap-3">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.current} htmlFor="acc-current" error={errors.current_password?.message} required>
              <Controller
                control={form.control}
                name="current_password"
                render={({ field }) => <PasswordInput id="acc-current" autoComplete="current-password" value={field.value} onChange={field.onChange} aria-invalid={!!errors.current_password} />}
              />
            </Field>
            <Field label={t.new} htmlFor="acc-new" hint={t.newHint} error={errors.password?.message} required>
              <Controller
                control={form.control}
                name="password"
                render={({ field }) => <PasswordInput id="acc-new" autoComplete="new-password" value={field.value} onChange={field.onChange} aria-invalid={!!errors.password} />}
              />
            </Field>
          </div>
        </PanelBody>
        <PanelFooter>
          <Button type="submit" loading={isSubmitting}>
            {t.change}
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}
