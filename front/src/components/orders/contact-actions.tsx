"use client";

import { CalendarClock, MessageCircle, Phone, PhoneMissed } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/components/dashboard/session-context";
import { DateTimeField } from "@/components/forms/datetime-field";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { recordContact, type ContactResult, type OrderDetail } from "@/lib/orders/api";
import { fillWhatsappTemplate, telLink, whatsappLink } from "@/lib/orders/whatsapp";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.orders.contact;

/**
 * Call-center actions on a new order: call, WhatsApp with the store's message (logged),
 * no answer (back in the queue in 2 hours) and postpone to a chosen time.
 */
export function ContactActions({
  order,
  onChange,
  size = "default",
  className,
}: {
  order: OrderDetail;
  /** Called with the updated order and what was logged. */
  onChange: (order: OrderDetail, result: ContactResult) => void;
  size?: "default" | "lg";
  className?: string;
}) {
  const session = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [postponing, setPostponing] = useState(false);
  const open = order.status === "new";
  const message = fillWhatsappTemplate(session.tenant?.whatsapp_template, order, order.brand.name || session.tenant?.name || "", formatPrice);

  async function log(result: "no_answer" | "whatsapp") {
    setBusy(result);
    try {
      onChange(await recordContact(order.id, result), result);
      toast.success(t.logged[result]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const big = size === "lg";
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className={cn("grid gap-2", big ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        <Button variant="outline" size={big ? "lg" : "default"} asChild>
          <a href={telLink(order.customer_phone)}>
            <Phone />
            {t.call}
          </a>
        </Button>
        <Button variant="outline" size={big ? "lg" : "default"} asChild className="border-success/40 text-success hover:bg-success/10">
          <a href={whatsappLink(order.customer_phone, message)} target="_blank" rel="noopener noreferrer" onClick={() => open && void log("whatsapp")}>
            <MessageCircle />
            {t.whatsapp}
          </a>
        </Button>
        {open ? (
          <>
            <Button variant="outline" size={big ? "lg" : "default"} loading={busy === "no_answer"} onClick={() => void log("no_answer")} data-action="no-answer">
              <PhoneMissed />
              {t.noAnswer}
            </Button>
            <Button variant="outline" size={big ? "lg" : "default"} onClick={() => setPostponing(true)}>
              <CalendarClock />
              {t.postpone}
            </Button>
          </>
        ) : null}
      </div>
      {open ? (
        <p className="text-xs text-muted-foreground">
          {t.attempts(order.contact_attempts)}
          {order.follow_up_at ? ` · ${t.nextCall(formatCairo(order.follow_up_at))}` : ""}
        </p>
      ) : null}
      {postponing ? <PostponeDialog order={order} onClose={() => setPostponing(false)} onDone={(updated) => onChange(updated, "postponed")} /> : null}
    </div>
  );
}

function PostponeDialog({ order, onClose, onDone }: { order: OrderDetail; onClose: () => void; onDone: (order: OrderDetail) => void }) {
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      onDone(await recordContact(order.id, "postponed", { follow_up_at: when, note: note.trim() || undefined }));
      toast.success(t.logged.postponed);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setError(err.errors.follow_up_at?.[0] ?? err.message);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t.postponeTitle}</DialogTitle>
          <DialogDescription>
            #{order.order_number} · {order.customer_name}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label={t.postponeWhen} htmlFor="follow-up" error={error} required>
            <DateTimeField id="follow-up" value={when} onChange={setWhen} invalid={Boolean(error)} emptyLabel={ar.common.pickDate} />
          </FormField>
          <FormField label={t.postponeNote} htmlFor="follow-note">
            <Textarea id="follow-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {ar.common.cancel}
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!when}>
            {t.postponeSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
