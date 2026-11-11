"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PasswordInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, applyServerErrors, errorMessage } from "@/lib/api/errors";
import { safeNext } from "@/lib/auth/redirect";
import { zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";
import { AuthHeading, AuthSwitch } from "./auth-heading";
import { homeFor, submitAuth } from "./submit";

const t = ar.auth;

const schema = z.object({
  login: zRequiredString(191),
  password: z.string().min(1, ar.validation.required),
});

type Values = z.infer<typeof schema>;

/** One sign in for store owners and the platform admin; the role decides where it lands. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { login: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const data = await submitAuth("/api/auth/login", values);
      router.replace(safeNext(params.get("next"), homeFor(data.user?.role)));
      router.refresh();
    } catch (error) {
      // Wrong email/password: one message on top (never say which one was wrong).
      if (error instanceof ApiError && error.code === "invalid_credentials") {
        setFormError(error.message);
        return;
      }
      const unmatched = applyServerErrors(error, form.setError, ["password"]);
      if (unmatched.length || !(error instanceof ApiError && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <>
      <AuthHeading title={t.loginTitle} subtitle={t.loginSubtitle} />
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <Field label={t.login} htmlFor="login" error={errors.login?.message}>
          <Input
            id="login"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            className="h-11 text-start"
            placeholder={t.loginPlaceholder}
            aria-invalid={!!errors.login}
            aria-describedby={errors.login ? "login-error" : undefined}
            {...form.register("login")}
          />
        </Field>
        <Field label={t.password} htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            inputClassName="h-11"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...form.register("password")}
          />
        </Field>
        <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
          {t.submitLogin}
        </Button>
        <p className="text-center text-xs text-ink-3">{t.forgotHint}</p>
      </form>
      <AuthSwitch question={t.noAccount} action={t.createAccount} href="/register" />
    </>
  );
}
