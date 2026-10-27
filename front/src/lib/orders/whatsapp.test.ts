import { describe, expect, it } from "vitest";
import { DEFAULT_WHATSAPP_TEMPLATE, fillWhatsappTemplate, telLink, whatsappLink } from "./whatsapp";

const order = {
  order_number: 1024,
  customer_name: "دينا طارق",
  governorate: "بورسعيد",
  address: "شارع 23 يوليو",
  total: 930,
  items: [{ product_name: "ساعة ذكية", quantity: 2, options: [{ value: "ذهبي" }, { value: "46 مم" }] }],
};
const money = (n: number) => `${n} ج.م`;

describe("WhatsApp confirmation", () => {
  it("fills every placeholder and keeps unknown ones", () => {
    const text = fillWhatsappTemplate("{الاسم} #{رقم_الطلب} {المنتج} {الإجمالي} {المحافظة} {العنوان} {المتجر} {مش_موجود}", order, "متجر رشاد", money);
    expect(text).toBe("دينا #1024 2 × ساعة ذكية (ذهبي، 46 مم) 930 ج.م بورسعيد شارع 23 يوليو متجر رشاد {مش_موجود}");
  });

  it("uses the default message when the store has none", () => {
    expect(fillWhatsappTemplate(null, order, "متجر", money)).toContain("بنأكد طلبك رقم #1024");
    expect(fillWhatsappTemplate("   ", order, "متجر", money)).toBe(fillWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE, order, "متجر", money));
  });

  it("builds wa.me and tel links", () => {
    expect(whatsappLink("+201012345678", "أهلًا & مرحبًا")).toBe("https://wa.me/201012345678?text=%D8%A3%D9%87%D9%84%D9%8B%D8%A7%20%26%20%D9%85%D8%B1%D8%AD%D8%A8%D9%8B%D8%A7");
    expect(whatsappLink("+201012345678")).toBe("https://wa.me/201012345678");
    expect(telLink("+201012345678")).toBe("tel:01012345678");
  });
});
