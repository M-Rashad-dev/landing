"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PasswordInput, PhoneInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, applyServerErrors, errorMessage } from "@/lib/api/errors";
import { normalizePhone } from "@/lib/phone";
import { zEmail, zPassword, zPhone, zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";
import { AuthHeading, AuthSwitch } from "./auth-heading";
import { submitAuth } from "./submit";

const t = ar.auth;

const schema = z.object({
  name: zRequiredString(100, 2),
  store_name: zRequiredString(100, 2),
  email: zEmail,
  phone: zPhone,
  password: zPassword,
});

type Values = z.infer<typeof schema>;
const FIELDS = ["name", "store_name", "email", "phone", "password"] as const;

/**
 * Store owner sign up: one short form and one password with an eye (no "repeat password";
 * the back end still receives the confirmation it expects).
 */
export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", store_name: "", email: "", phone: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const describe = (name: keyof Values, hint = false) => (errors[name] ? `${name}-error` : hint ? `${name}-hint` : undefined);

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await submitAuth("/api/auth/register", {
        ...values,
        phone: normalizePhone(values.phone) ?? values.phone,
        password_confirmation: values.password,
      });
      toast.success(t.welcome);
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, FIELDS);
      if (unmatched.length || !(error instanceof ApiError && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <>
      <AuthHeading title={t.registerTitle} subtitle={t.registerSubtitle} />
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.name} htmlFor="name" error={errors.name?.message}>
            <Input id="name" autoComplete="name" className="h-11" placeholder={t.namePlaceholder} aria-invalid={!!errors.name} aria-describedby={describe("name")} {...form.register("name")} />
          </Field>
          <Field label={t.storeName} htmlFor="store_name" error={errors.store_name?.message}>
            <Input id="store_name" autoComplete="organization" className="h-11" placeholder={t.storeNamePlaceholder} aria-invalid={!!errors.store_name} aria-describedby={describe("store_name")} {...form.register("store_name")} />
          </Field>
        </div>
        <Field label={t.email} htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" dir="ltr" className="h-11 text-start" placeholder="name@example.com" aria-invalid={!!errors.email} aria-describedby={describe("email")} {...form.register("email")} />
        </Field>
        <Field label={t.phone} htmlFor="phone" hint={t.phoneHint} error={errors.phone?.message}>
          <PhoneInput id="phone" inputClassName="h-11 tabular" aria-invalid={!!errors.phone} aria-describedby={describe("phone", true)} {...form.register("phone")} />
        </Field>
        <Field label={t.password} htmlFor="password" hint={t.passwordHint} error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" inputClassName="h-11" aria-invalid={!!errors.password} aria-describedby={describe("password", true)} {...form.register("password")} />
        </Field>
        <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
          {t.submitRegister}
        </Button>
      </form>
      <AuthSwitch question={t.haveAccount} action={t.signIn} href="/login" />
    </>
  );
}
