"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, applyServerErrors, errorMessage, type ApiErrorBody } from "@/lib/api/errors";
import { postAuth } from "@/lib/auth/redirect";
import { normalizePhone } from "@/lib/format/phone";
import { zEmail, zPassword, zPhone, zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";

const schema = z
  .object({
    name: zRequiredString(100, 2),
    email: zEmail,
    phone: zPhone,
    store_name: zRequiredString(100, 2),
    password: zPassword,
    password_confirmation: z.string().min(1, ar.validation.required),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ["password_confirmation"],
    message: ar.validation.passwordMismatch,
  });

type Values = z.infer<typeof schema>;
const FIELDS = ["name", "email", "phone", "store_name", "password", "password_confirmation"] as const;

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", phone: "", store_name: "", password: "", password_confirmation: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const response = await postAuth("/api/auth/register", { ...values, phone: normalizePhone(values.phone) ?? values.phone });
      const json = (await response.json().catch(() => ({}))) as ApiErrorBody;
      if (!response.ok) throw new ApiError(response.status, json);

      toast.success(ar.auth.welcome);
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, FIELDS);
      if (unmatched.length || !(error instanceof ApiError && error.isValidation)) {
        setFormError(unmatched[0] ?? errorMessage(error));
      }
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">{ar.auth.registerTitle}</h1>
        <p className="mt-2 text-muted-foreground">{ar.auth.registerSubtitle}</p>
      </div>
      <div>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {formError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {formError}
            </p>
          ) : null}
          <FormField label={ar.auth.name} htmlFor="name" error={errors.name?.message} required>
            <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...form.register("name")} />
          </FormField>
          <FormField label={ar.auth.email} htmlFor="email" error={errors.email?.message} required>
            <Input id="email" type="email" autoComplete="email" inputMode="email" dir="ltr" className="text-start" aria-invalid={!!errors.email} {...form.register("email")} />
          </FormField>
          <FormField label={ar.auth.phone} htmlFor="phone" error={errors.phone?.message} hint={ar.auth.phoneHint} required>
            <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" dir="ltr" className="text-start" placeholder="01xxxxxxxxx" aria-invalid={!!errors.phone} {...form.register("phone")} />
          </FormField>
          <FormField label={ar.auth.storeName} htmlFor="store_name" error={errors.store_name?.message} hint={ar.auth.storeNameHint} required>
            <Input id="store_name" autoComplete="organization" aria-invalid={!!errors.store_name} {...form.register("store_name")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={ar.auth.password} htmlFor="password" error={errors.password?.message} required>
              <Input id="password" type="password" autoComplete="new-password" dir="ltr" aria-invalid={!!errors.password} {...form.register("password")} />
            </FormField>
            <FormField label={ar.auth.passwordConfirmation} htmlFor="password_confirmation" error={errors.password_confirmation?.message} required>
              <Input id="password_confirmation" type="password" autoComplete="new-password" dir="ltr" aria-invalid={!!errors.password_confirmation} {...form.register("password_confirmation")} />
            </FormField>
          </div>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {ar.auth.submitRegister}
          </Button>
          <p className="text-center text-sm">
            {ar.auth.haveAccount}{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {ar.auth.signIn}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
