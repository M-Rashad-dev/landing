"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { ar } from "@/messages/ar";

const t = ar.storefront.questions;

/** The anti-bot token is refused younger than 3 seconds (back end: FormToken::MIN_AGE_SECONDS). */
const TOKEN_MIN_AGE_MS = 3500;

export const questionSchema = z.object({
  name: z.string().trim().min(1, t.errors.name).max(60, t.errors.name),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || normalizePhone(v) !== null, t.errors.phone),
  question: z.string().trim().min(5, t.errors.question).max(500, t.errors.questionLong),
  // Honeypot: people never see it, bots fill it.
  website: z.string().max(200),
});
export type QuestionValues = z.infer<typeof questionSchema>;

const FIELDS = ["name", "phone", "question"] as const;

/**
 * «اسأل سؤال» (docs/plans/tekno/PLAN.md §3): the form (name, optional phone, question, honeypot), its anti-bot token
 * and sending it. Every theme's questions block draws its own fields on this hook. `sent` stays true until `again()`.
 */
export function useQuestionForm(slug: string) {
  const form = useForm<QuestionValues>({ resolver: zodResolver(questionSchema), defaultValues: { name: "", phone: "", question: "", website: "" }, mode: "onTouched" });
  const [token, setToken] = React.useState<Token | null>(null);
  // A new token for each form (another question after «وصل سؤالك» counts as a new form).
  const [round, setRound] = React.useState(0);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    void fetchToken().then((t) => alive && setToken(t));
    return () => {
      alive = false;
    };
  }, [round]);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    const current = token ?? (await fetchToken());
    if (current) await waitOut(current);
    try {
      const response = await fetch("/api/public/store/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ slug, name: values.name.trim(), phone: values.phone.trim() || null, question: values.question.trim(), form_token: current?.value ?? null, website: values.website }),
      });
      if (response.ok) {
        form.reset();
        setSent(true);
        return;
      }
      const json = (await response.json().catch(() => null)) as { message?: string; errors?: Record<string, string[]> } | null;
      let shown = false;
      for (const field of FIELDS) {
        const message = json?.errors?.[field]?.[0];
        if (message) {
          form.setError(field, { message });
          shown = true;
        }
      }
      if (!shown) setError(json?.message ?? t.errors.failed);
    } catch {
      setError(t.errors.failed);
    }
  });

  const again = () => {
    setSent(false);
    setToken(null);
    setRound((r) => r + 1);
  };

  return { form, submit, sent, error, busy: form.formState.isSubmitting, again };
}

type Token = { value: string; at: number };

/** This store's anti-bot token, with when it came (null when it couldn't be read: the server then keeps nothing). */
async function fetchToken(): Promise<Token | null> {
  try {
    const response = await fetch("/api/public/store/form-token", { headers: { Accept: "application/json" } });
    const json = (await response.json()) as { data?: { token?: string } };
    return json.data?.token ? { value: json.data.token, at: Date.now() } : null;
  } catch {
    return null;
  }
}

/** A question sent within 3 seconds of opening the form waits out the token's minimum age. */
async function waitOut(token: Token): Promise<void> {
  const wait = token.at + TOKEN_MIN_AGE_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
}
