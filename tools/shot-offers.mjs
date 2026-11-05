import { chromium } from "@playwright/test";

// Offer picker: create the three offer kinds, switch the form to "customer picks", pick cards on
// the public page and order with the gift.
const out = process.argv[2];
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://app.localhost:3000/login");
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");
const call = (path, method = "GET", body) =>
  page.evaluate(async ({ path, method, body }) => {
    const res = await fetch(`/api/bff${path}`, { method, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json().catch(() => null) };
  }, { path, method, body });

const products = (await call("/dashboard/products?per_page=100")).json.data;
const watch = products.find((p) => p.name.includes("ساعة ذكية"));
let strap = products.find((p) => p.name.includes("حزام"));
if (!strap) strap = (await call("/dashboard/products", "POST", { name: "حزام سيليكون إضافي", price: "180" })).json.data;

for (const o of (await call("/dashboard/offers?per_page=100")).json.data) await call(`/dashboard/offers/${o.id}`, "DELETE");
const mk = async (body) => {
  const r = await call("/dashboard/offers", "POST", { is_active: true, product_ids: [watch.id], priority: 0, ...body });
  if (r.status !== 201) throw new Error(JSON.stringify(r.json).slice(0, 300));
};
await mk({ name: "اشترِ 2 وخد خصم 20%", type: "percentage", value: 20, min_quantity: 2, badge_text: "الأكثر طلبًا" });
await mk({ name: "اشترِ 5 والسادسة مجانًا", type: "buy_get", min_quantity: 5, free_quantity: 1 });
await mk({ name: "حزام سيليكون هدية", type: "gift", gift_product_id: strap.id, priority: 5 });

// Dashboard offers list with the new types.
await page.goto("http://app.localhost:3000/dashboard/offers");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/offers-list.png` });
await page.getByRole("button", { name: "عرض جديد" }).first().click();
await page.getByRole("radio", { name: /هدية منتج/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/offer-form-gift.png` });
await page.keyboard.press("Escape");

// Turn the picker on for the home page and publish.
const pages = (await call("/dashboard/pages?status=published")).json.data;
const home = pages.find((p) => p.is_home) ?? pages[0];
const detail = (await call(`/dashboard/pages/${home.id}`)).json.data;
const sections = detail.draft_content.sections.map((s) => (s.type === "order_form" ? { ...s, props: { ...s.props, offer_picker: true } } : s));
const saved = await call(`/dashboard/pages/${home.id}/content`, "PUT", { version: detail.version, content: { ...detail.draft_content, sections } });
console.log("save:", saved.status, "publish:", (await call(`/dashboard/pages/${home.id}/publish`, "POST")).status, home.slug);

const site = await browser.newPage({ viewport: { width: 390, height: 844 } });
site.on("pageerror", (e) => errors.push(String(e)));
await site.goto(`http://demo-store-2857.localhost:3000/${home.slug}`, { waitUntil: "load" });
const form = site.locator("#order form");
await form.scrollIntoViewIfNeeded();
await site.waitForTimeout(3500);
const picker = site.getByRole("radiogroup", { name: "اختار العرض اللي يناسبك" });
console.log("cards:", (await picker.getByRole("radio").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()).join(" | "));
console.log("auto selected:", (await picker.locator('[aria-checked="true"]').textContent())?.replace(/\s+/g, " ").trim());
await picker.screenshot({ path: `${out}/picker-auto.png` });
await picker.getByRole("radio", { name: /السادسة مجانًا/ }).click();
await site.waitForTimeout(1500);
console.log("after buy_get: quantity", await form.locator('output').first().textContent(), "| summary:", (await form.locator('[aria-busy]').innerText()).replace(/\s+/g, " "));
await picker.getByRole("radio", { name: /حزام سيليكون هدية/ }).click();
await site.waitForTimeout(1500);
console.log("after gift summary:", (await form.locator('[aria-busy]').innerText()).replace(/\s+/g, " "));
await form.getByLabel(/^الاسم/).fill("عميل العروض");
await form.getByLabel(/^رقم الموبايل/).fill(`015${String(Date.now()).slice(-8)}`);
const address = form.getByLabel(/^العنوان/);
if (await address.count()) await address.first().fill("شارع 9");
const sel = form.locator("select");
if (await sel.count()) await sel.first().selectOption({ index: 1 });
for (const group of await form.getByRole("radiogroup").all()) {
  if ((await group.getAttribute("aria-label")) === "اختار العرض اللي يناسبك") continue;
  await group.getByRole("radio").first().click();
}
await site.waitForTimeout(800);
await form.screenshot({ path: `${out}/picker-form.png` });
await form.getByRole("button", { name: /تأكيد الطلب/ }).click();
await site.getByText(/تم استلام طلبك/).waitFor({ timeout: 15000 });
const orders = (await call("/dashboard/orders?per_page=1")).json.data;
const order = (await call(`/dashboard/orders/${orders[0].id}`)).json.data;
console.log("order:", order.order_number, order.offer_name, order.items.map((i) => `${i.product_name}${i.is_gift ? " (هدية)" : ""} ${i.line_total}`).join(" + "), "total", order.total);
await browser.close();
console.log("errors:", errors.length ? errors : "none");
