"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useSession } from "@/components/dashboard/session-context";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/api/client";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { formatPhoneLocal, normalizePhone } from "@/lib/format/phone";
import { zEmail, zPassword, zPhone, zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";

function handleError(error: unknown, apply: () => string[]) {
  const unmatched = apply();
  if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
}

const storeSchema = z.object({ name: zRequiredString(100, 2) });

export function StoreForm() {
  const session = useSession();
  const router = useRouter();
  const form = useForm<z.infer<typeof storeSchema>>({
    resolver: zodResolver(storeSchema),
    defaultValues: { name: session.tenant?.name ?? "" },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: z.infer<typeof storeSchema>) {
    try {
      await api("/dashboard/store", { method: "PATCH", body: values });
      toast.success(ar.settings.storeSaved);
      form.reset(values);
      router.refresh();
    } catch (error) {
      handleError(error, () => applyServerErrors(error, form.setError, ["name"]));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ar.settings.storeTitle}</CardTitle>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent>
          <FormField label={ar.auth.storeName} htmlFor="store-name" error={errors.name?.message} hint={ar.auth.storeNameHint} required>
            <Input id="store-name" aria-invalid={!!errors.name} {...form.register("name")} />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const profileSchema = z.object({ name: zRequiredString(100, 2), email: zEmail, phone: zPhone });

export function ProfileForm() {
  const session = useSession();
  const router = useRouter();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: session.user.name, email: session.user.email, phone: formatPhoneLocal(session.user.phone) },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    try {
      await api("/dashboard/profile", { method: "PATCH", body: { ...values, phone: normalizePhone(values.phone) ?? values.phone } });
      toast.success(ar.settings.profileSaved);
      form.reset(values);
      router.refresh();
    } catch (error) {
      handleError(error, () => applyServerErrors(error, form.setError, ["name", "email", "phone"]));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ar.settings.profileTitle}</CardTitle>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4">
          <FormField label={ar.auth.name} htmlFor="profile-name" error={errors.name?.message} required>
            <Input id="profile-name" autoComplete="name" aria-invalid={!!errors.name} {...form.register("name")} />
          </FormField>
          <FormField label={ar.auth.email} htmlFor="profile-email" error={errors.email?.message} required>
            <Input id="profile-email" type="email" dir="ltr" className="text-start" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
          </FormField>
          <FormField label={ar.auth.phone} htmlFor="profile-phone" error={errors.phone?.message} required>
            <Input id="profile-phone" type="tel" inputMode="tel" dir="ltr" className="text-start" autoComplete="tel" aria-invalid={!!errors.phone} {...form.register("phone")} />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const passwordSchema = z
  .object({
    current_password: z.string().min(1, ar.validation.required),
    password: zPassword,
    password_confirmation: z.string().min(1, ar.validation.required),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: ar.validation.passwordMismatch })
  .refine((v) => v.password !== v.current_password, { path: ["password"], message: ar.validation.passwordSame });

type PasswordValues = z.infer<typeof passwordSchema>;

export function PasswordForm() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", password: "", password_confirmation: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: PasswordValues) {
    try {
      await api("/dashboard/profile/password", { method: "PUT", body: values });
      toast.success(ar.settings.passwordSaved);
      form.reset();
    } catch (error) {
      handleError(error, () => applyServerErrors(error, form.setError, ["current_password", "password", "password_confirmation"]));
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{ar.settings.passwordTitle}</CardTitle>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4">
          <FormField label={ar.settings.currentPassword} htmlFor="current_password" error={errors.current_password?.message} required>
            <Input id="current_password" type="password" dir="ltr" autoComplete="current-password" aria-invalid={!!errors.current_password} {...form.register("current_password")} />
          </FormField>
          <FormField label={ar.settings.newPassword} htmlFor="new_password" error={errors.password?.message} required>
            <Input id="new_password" type="password" dir="ltr" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
          </FormField>
          <FormField label={ar.settings.confirmPassword} htmlFor="password_confirmation" error={errors.password_confirmation?.message} required>
            <Input id="password_confirmation" type="password" dir="ltr" autoComplete="new-password" aria-invalid={!!errors.password_confirmation} {...form.register("password_confirmation")} />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting}>
            {ar.settings.changePassword}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
