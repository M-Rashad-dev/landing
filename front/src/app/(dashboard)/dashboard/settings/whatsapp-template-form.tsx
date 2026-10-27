"use client";

import { MessageCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useSession } from "@/components/dashboard/session-context";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { DEFAULT_WHATSAPP_TEMPLATE, fillWhatsappTemplate, WHATSAPP_PLACEHOLDERS } from "@/lib/orders/whatsapp";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const t = ar.orders.whatsappTemplate;

/** The WhatsApp confirmation message: placeholders insert at the cursor, with a live preview bubble. */
export function WhatsappTemplateForm() {
  const session = useSession();
  const router = useRouter();
  const saved = session.tenant?.whatsapp_template ?? DEFAULT_WHATSAPP_TEMPLATE;
  const [text, setText] = useState(saved);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const sample = fillWhatsappTemplate(
    text,
    { order_number: 1024, customer_name: t.sample.name, governorate: t.sample.governorate, address: t.sample.address, total: 850, items: [{ product_name: t.sample.product, quantity: 1, options: [] }] },
    session.tenant?.name ?? "",
    formatPrice,
  );

  function insert(placeholder: string) {
    const el = area.current;
    const token = `{${placeholder}}`;
    if (!el) return setText((value) => value + token);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      // The default text is stored as "no custom message", so future default improvements apply.
      await api("/dashboard/store", { method: "PATCH", body: { whatsapp_template: text.trim() === DEFAULT_WHATSAPP_TEMPLATE ? null : text } });
      toast.success(t.saved);
      router.refresh();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setError(err.errors.whatsapp_template?.[0] ?? err.message);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="size-4 text-success" aria-hidden />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <FormField label={t.label} htmlFor="wa-template" error={error}>
            <Textarea id="wa-template" ref={area} rows={8} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={Boolean(error)} />
          </FormField>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t.insert}</span>
            {WHATSAPP_PLACEHOLDERS.map((placeholder) => (
              <button key={placeholder} type="button" onClick={() => insert(placeholder)} className="rounded-full border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary">
                {`{${placeholder}}`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">{t.preview}</p>
          <div className="rounded-xl bg-[#efe7dd] p-4">
            <p className="ms-auto w-fit max-w-[90%] whitespace-pre-line rounded-xl rounded-se-none bg-[#d9fdd3] px-3 py-2 text-sm leading-relaxed text-[#111b21] shadow-xs">{sample}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => setText(DEFAULT_WHATSAPP_TEMPLATE)}>
          <RotateCcw />
          {t.reset}
        </Button>
        <Button type="button" onClick={() => void save()} loading={saving} disabled={text === saved}>
          {ar.common.save}
        </Button>
      </CardFooter>
    </Card>
  );
}
