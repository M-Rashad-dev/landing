"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, applyServerErrors, errorMessage, type ApiErrorBody } from "@/lib/api/errors";
import { postAuth, safeNext } from "@/lib/auth/redirect";
import { zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";

const schema = z.object({
  login: zRequiredString(191),
  password: z.string().min(1, ar.validation.required),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { login: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const response = await postAuth("/api/auth/login", values);
      const json = (await response.json().catch(() => ({}))) as ApiErrorBody & { data?: { user?: { role?: string } } };
      if (!response.ok) throw new ApiError(response.status, json);

      const fallback = json.data?.user?.role === "super_admin" ? "/admin" : "/dashboard";
      router.replace(safeNext(params.get("next"), fallback));
      router.refresh();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["password"]);
      if (error instanceof ApiError && error.code === "invalid_credentials") {
        setFormError(error.message);
      } else if (unmatched.length || !(error instanceof ApiError && error.isValidation)) {
        setFormError(unmatched[0] ?? errorMessage(error));
      }
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{ar.auth.loginTitle}</CardTitle>
        <CardDescription>{ar.auth.loginSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {formError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {formError}
            </p>
          ) : null}
          <FormField label={ar.auth.login} htmlFor="login" error={errors.login?.message} required>
            <Input id="login" autoComplete="username" inputMode="email" dir="ltr" className="text-start" placeholder={ar.auth.loginPlaceholder} aria-invalid={!!errors.login} {...form.register("login")} />
          </FormField>
          <FormField label={ar.auth.password} htmlFor="password" error={errors.password?.message} required>
            <Input id="password" type="password" autoComplete="current-password" dir="ltr" aria-invalid={!!errors.password} {...form.register("password")} />
          </FormField>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {ar.auth.submitLogin}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{ar.auth.forgotHint}</p>
          <p className="text-center text-sm">
            {ar.auth.noAccount}{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              {ar.auth.createAccount}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
