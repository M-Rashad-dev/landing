"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { anchorFor } from "@/components/builder/anchors";
import { normalizePhone } from "@/lib/format/phone";
import { safeHref } from "@/lib/links";
import { SCHEMAS } from "@/themes/shared/schemas";
import { ar } from "@/messages/ar";
import type { FieldProps } from "./types";

type Kind = "none" | "section" | "external" | "phone" | "whatsapp";

export function detectKind(value: string): Kind {
  if (!value) return "none";
  if (value.startsWith("#")) return "section";
  if (value.startsWith("tel:")) return "phone";
  if (value.startsWith("https://wa.me/")) return "whatsapp";
  return "external";
}

/** Link picker: section anchor, external https URL, phone call or WhatsApp (stored as a safe href). */
export function LinkField({ value, onChange, ctx, id }: FieldProps<string>) {
  const current = typeof value === "string" ? value : "";
  const [kind, setKind] = useState<Kind>(detectKind(current));
  const [draft, setDraft] = useState(() => (kind === "phone" ? current.slice(4) : kind === "whatsapp" ? current.replace("https://wa.me/", "") : current));
  const t = ar.fields;

  const anchors = ctx.sections
    .filter((s) => s.type !== "header")
    .map((s) => ({ value: `#${anchorFor(s)}`, label: s.type === "order_form" ? t.linkOrder : SCHEMAS[s.type].label }));
  if (!anchors.some((a) => a.value === "#order")) anchors.unshift({ value: "#order", label: t.linkOrder });

  const invalid = kind === "external" && draft !== "" && !safeHref(draft);

  function changeKind(next: Kind) {
    setKind(next);
    setDraft("");
    onChange(next === "section" ? "#order" : "");
  }

  function changeDraft(text: string) {
    setDraft(text);
    if (kind === "external") {
      onChange(safeHref(text.trim()) ? text.trim() : "");
    } else if (kind === "phone" || kind === "whatsapp") {
      const phone = normalizePhone(text);
      if (!phone) return onChange("");
      onChange(kind === "phone" ? `tel:${phone}` : `https://wa.me/${phone.replace("+", "")}`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Select
        id={id}
        value={kind}
        onChange={(event) => changeKind(event.target.value as Kind)}
        options={(["section", "external", "phone", "whatsapp", "none"] as const).map((k) => ({ value: k, label: t.linkKinds[k] }))}
      />
      {kind === "section" ? (
        <Select aria-label={t.chooseSection} value={current} onChange={(event) => onChange(event.target.value)} options={anchors} />
      ) : kind === "external" ? (
        <Input aria-label={t.linkKinds.external} dir="ltr" className="text-start" placeholder={t.urlPlaceholder} value={draft} onChange={(event) => changeDraft(event.target.value)} aria-invalid={invalid} />
      ) : kind === "phone" || kind === "whatsapp" ? (
        <Input aria-label={t.linkKinds[kind]} type="tel" dir="ltr" className="text-start" placeholder={t.phonePlaceholder} value={draft} onChange={(event) => changeDraft(event.target.value)} />
      ) : null}
      {invalid ? <p className="text-xs text-destructive">{t.invalidLink}</p> : null}
    </div>
  );
}
