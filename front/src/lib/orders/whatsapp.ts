import { formatPhoneLocal } from "@/lib/format/phone";

/** Placeholders the seller can use in the WhatsApp confirmation message. */
export const WHATSAPP_PLACEHOLDERS = ["الاسم", "رقم_الطلب", "المنتج", "الإجمالي", "المحافظة", "العنوان", "المتجر"] as const;
export type WhatsappPlaceholder = (typeof WHATSAPP_PLACEHOLDERS)[number];

export const DEFAULT_WHATSAPP_TEMPLATE = [
  "أهلًا {الاسم} 👋",
  "معاك {المتجر}، بنأكد طلبك رقم #{رقم_الطلب}:",
  "{المنتج}",
  "الإجمالي: {الإجمالي} (الدفع عند الاستلام)",
  "العنوان: {المحافظة} - {العنوان}",
  "نأكد الشحن؟ ✅",
].join("\n");

export type TemplateOrder = {
  order_number: number;
  customer_name: string;
  governorate: string | null;
  address?: string | null;
  total: number;
  product?: { name: string } | null;
  items?: Array<{ product_name: string; quantity: number; options: Array<{ value: string }> }>;
};

/** The message for one order: unknown placeholders are left as typed. */
export function fillWhatsappTemplate(template: string | null | undefined, order: TemplateOrder, store: string, formatMoney: (n: number) => string): string {
  const product = order.items?.length
    ? order.items.map((item) => `${item.quantity} × ${item.product_name}${item.options.length ? ` (${item.options.map((o) => o.value).join("، ")})` : ""}`).join("\n")
    : (order.product?.name ?? "");
  const values: Record<WhatsappPlaceholder, string> = {
    الاسم: order.customer_name.split(" ")[0] ?? order.customer_name,
    رقم_الطلب: String(order.order_number),
    المنتج: product,
    الإجمالي: formatMoney(order.total),
    المحافظة: order.governorate ?? "",
    العنوان: order.address ?? "",
    المتجر: store,
  };
  return (template?.trim() || DEFAULT_WHATSAPP_TEMPLATE).replace(/\{([^{}]+)\}/g, (match, key: string) => (key in values ? values[key as WhatsappPlaceholder] : match));
}

/** wa.me link (Egyptian numbers stored as +20…), optionally with a ready message. */
export function whatsappLink(phone: string, text?: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** tel: link with the local format (dials from any Egyptian phone). */
export function telLink(phone: string): string {
  return `tel:${formatPhoneLocal(phone)}`;
}
