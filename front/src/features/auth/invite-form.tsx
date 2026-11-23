"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LinkIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PasswordInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { postAuth } from "@/lib/auth/redirect";
import { ar } from "@/messages/ar";
import { AuthHeading } from "./auth-heading";

const t = ar.staff.invite;

const schema = z
  .object({ password: z.string().min(8, ar.auth.passwordHint), password_confirmation: z.string().min(1, ar.validation.required) })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: t.mismatch });
type Values = z.infer<typeof schema>;

type Invitation = { name: string; email: string; store: string | null };

/** A new staff member sets his password from the emailed link, then lands in the dashboard. */
export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = React.useState<Invitation | null | "invalid">(null);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", password_confirmation: "" } });
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    let alive = true;
    postAuth("/api/auth/invitation/check", { token })
      .then(async (r) => ({ ok: r.ok, json: (await r.json().catch(() => ({}))) as { data?: Invitation } }))
      .then(({ ok, json }) => alive && setInvitation(ok && json.data ? json.data : "invalid"))
      .catch(() => alive && setInvitation("invalid"));
    return () => {
      alive = false;
    };
  }, [token]);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const response = await postAuth("/api/auth/invitation/accept", { token, ...values });
      if (response.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      const json = (await response.json().catch(() => ({}))) as { message?: string };
      if (response.status === 410) setInvitation("invalid");
      else setError(json.message ?? ar.errors.generic);
    } catch {
      setError(ar.errors.network);
    }
  });

  if (invitation === null) {
    return (
      <div className="flex justify-center py-10" role="status">
        <Loader2 className="size-7 animate-spin text-ink-3" aria-hidden />
      </div>
    );
  }
  if (invitation === "invalid") {
    return (
      <EmptyState
        icon={LinkIcon}
        title={t.invalidTitle}
        description={t.invalidText}
        action={
          <Button asChild>
            <Link href="/login">{t.toLogin}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <AuthHeading title={t.title(invitation.store ?? "")} subtitle={t.subtitle(invitation.name)} />
      <p className="text-sm text-ink-2" dir="ltr">
        {invitation.email}
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label={t.password} htmlFor="inv-pass" error={errors.password?.message}>
        <PasswordInput id="inv-pass" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label={t.confirm} htmlFor="inv-pass2" error={errors.password_confirmation?.message}>
        <PasswordInput id="inv-pass2" autoComplete="new-password" {...form.register("password_confirmation")} />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        {t.submit}
      </Button>
    </form>
  );
}
