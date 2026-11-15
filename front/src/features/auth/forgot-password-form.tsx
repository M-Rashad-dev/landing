"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PasswordInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, type ApiErrorBody, applyServerErrors, errorMessage } from "@/lib/api/errors";
import { postAuth } from "@/lib/auth/redirect";
import { zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";
import { AuthHeading } from "./auth-heading";

const t = ar.auth;
const f = ar.auth.forgot;

type CodeSent = { channel: "whatsapp" | "screen"; expires_in: number; resend_in: number; code: string | null };

async function post<T>(path: "/api/auth/password/code" | "/api/auth/password/reset", body: unknown): Promise<T | null> {
  let response: Response;
  try {
    response = await postAuth(path, body);
  } catch {
    throw new ApiError(0, {});
  }
  if (response.status === 204) return null;
  const json = (await response.json().catch(() => ({}))) as ApiErrorBody & { data?: T };
  if (!response.ok) throw new ApiError(response.status, json);
  return json.data ?? null;
}

const loginSchema = z.object({ login: zRequiredString(191) });

const resetSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, f.codeError),
    password: z.string().min(8, t.passwordHint),
    password_confirmation: z.string().min(1, ar.validation.required),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: f.mismatch });

type ResetValues = z.infer<typeof resetSchema>;

/** "Forgot my password": email or phone → a code on WhatsApp → a new password. */
export function ForgotPasswordForm() {
  const [login, setLogin] = useState<string | null>(null);
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
          <CircleCheck className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">{f.doneTitle}</h1>
        <p className="mt-2 text-[15px] text-ink-2">{f.doneText}</p>
        <Button asChild size="lg" className="mt-7 w-full">
          <Link href="/login">{f.toLogin}</Link>
        </Button>
      </div>
    );
  }

  return login && sent ? (
    <ResetStep
      login={login}
      sent={sent}
      onResent={setSent}
      onChangeLogin={() => {
        setLogin(null);
        setSent(null);
      }}
      onDone={() => setDone(true)}
    />
  ) : (
    <LoginStep
      initial={login ?? ""}
      onSent={(value, answer) => {
        setLogin(value);
        setSent(answer);
      }}
    />
  );
}

function LoginStep({ initial, onSent }: { initial: string; onSent: (login: string, sent: CodeSent) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<{ login: string }>({ resolver: zodResolver(loginSchema), defaultValues: { login: initial } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: { login: string }) {
    setFormError(null);
    try {
      const answer = await post<CodeSent>("/api/auth/password/code", values);
      if (answer) onSent(values.login, answer);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["login"]);
      if (unmatched.length || !(error instanceof ApiError && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <>
      <AuthHeading title={f.title} subtitle={f.subtitle} />
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
        <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
          {f.send}
        </Button>
        <Link href="/login" className="self-center text-sm font-semibold text-brand-strong underline-offset-4 hover:underline">
          {f.back}
        </Link>
      </form>
    </>
  );
}

function ResetStep({
  login,
  sent,
  onResent,
  onChangeLogin,
  onDone,
}: {
  login: string;
  sent: CodeSent;
  onResent: (sent: CodeSent) => void;
  onChangeLogin: () => void;
  onDone: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [wait, setWait] = useState(sent.resend_in);
  const [resending, setResending] = useState(false);
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { code: "", password: "", password_confirmation: "" } });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setFormError(null);
    setResending(true);
    try {
      const answer = await post<CodeSent>("/api/auth/password/code", { login });
      if (answer) {
        onResent(answer);
        setWait(answer.resend_in);
        form.setValue("code", "");
      }
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(values: ResetValues) {
    setFormError(null);
    try {
      await post<null>("/api/auth/password/reset", { login, ...values });
      onDone();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["code", "password", "password_confirmation"]);
      if (unmatched.length || !(error instanceof ApiError && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <>
      <AuthHeading title={f.codeTitle} subtitle={f.codeSent} />
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        {sent.code ? (
          <Alert tone="warning" title={`${f.screenCode}: ${sent.code}`}>
            {f.screenNote}
          </Alert>
        ) : null}
        <Field label={f.code} htmlFor="code" error={errors.code?.message}>
          <Input
            id="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            dir="ltr"
            className="h-11 text-center text-lg tracking-[0.4em] tabular-nums"
            aria-invalid={!!errors.code}
            aria-describedby={errors.code ? "code-error" : undefined}
            {...form.register("code")}
          />
        </Field>
        <Field label={f.newPassword} htmlFor="password" hint={t.passwordHint} error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            inputClassName="h-11"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...form.register("password")}
          />
        </Field>
        <Field label={f.confirmPassword} htmlFor="password_confirmation" error={errors.password_confirmation?.message}>
          <PasswordInput
            id="password_confirmation"
            autoComplete="new-password"
            inputClassName="h-11"
            aria-invalid={!!errors.password_confirmation}
            aria-describedby={errors.password_confirmation ? "password_confirmation-error" : undefined}
            {...form.register("password_confirmation")}
          />
        </Field>
        <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
          {f.save}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {wait > 0 ? (
            <span className="text-ink-3 tabular-nums">{f.resendIn(wait)}</span>
          ) : (
            <Button type="button" variant="ghost" size="sm" loading={resending} onClick={resend}>
              {f.resend}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onChangeLogin}>
            {f.changeLogin}
          </Button>
        </div>
      </form>
    </>
  );
}
