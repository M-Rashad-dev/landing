/**
 * Link allow-list shared by the Builder, the themes (SafeLink) and Markdown.
 * Mirror of the back-end SafeUrl rule: #anchor, /relative-path, https://, tel:, mailto:, https://wa.me/.
 * Anything else (javascript:, data:, http:, protocol-relative //...) is rejected.
 */
export function safeHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value === "" || value.length > 2048) return null;
  // Control characters or whitespace inside a URL are a smell (e.g. "java\nscript:").
  if (/[\u0000-\u001F\u007F\s]/.test(value)) return null;

  if (/^#[A-Za-z0-9_-]{1,80}$/.test(value)) return value;
  if (/^\/(?!\/)[^\\]*$/.test(value)) return value;
  if (/^tel:\+?[0-9]{3,20}$/.test(value)) return value;
  if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(value)) return value;

  if (/^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
      return value;
    } catch {
      return null;
    }
  }
  return null;
}

export function isSafeHref(raw: string | null | undefined): boolean {
  return safeHref(raw) !== null;
}

/** wa.me link from an E.164 phone (+2010… → https://wa.me/2010…). */
export function whatsappHref(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^\d+]/g, "");
  return clean.length >= 3 ? `tel:${clean}` : null;
}
