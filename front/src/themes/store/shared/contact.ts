/** A number written by the merchant → a wa.me link (wa.me wants it international: Egyptian 01… becomes 201…). */
export function whatsappLink(number: string, text?: string): string {
  const base = `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "20")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** A number written by the merchant → a tel: link. */
export function telLink(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}
