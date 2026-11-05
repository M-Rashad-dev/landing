import { chromium } from "@playwright/test";

const out = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://app.localhost:3000/login");
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");

// A product without required options, and an upsell through the dashboard UI.
const strap = await page.evaluate(async () => {
  const res = await fetch("/api/bff/dashboard/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "حزام سيليكون إضافي", price: "180" }) });
  return (await res.json()).data;
});
await page.goto("http://app.localhost:3000/dashboard/upsells");
await page.getByRole("button", { name: "عرض جديد" }).first().click();
await page.locator("#up-trigger").click();
await page.getByRole("option", { name: /ساعة ذكية رياضية/ }).click();
console.log("strap:", JSON.stringify(strap).slice(0, 120));
await page.locator("#up-offer").click();
await page.waitForTimeout(500);
console.log("options:", (await page.getByRole("option").allTextContents()).join(" | "));
await page.getByRole("option", { name: new RegExp(strap.name) }).first().click();
await page.locator("#up-price").fill("99");
await page.locator("#up-name").fill("حزام مع الساعة");
await page.locator("#up-headline").fill("زوّد حزام سيليكون إضافي بـ 99 بس 🎁");
await page.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
await page.getByText("تم حفظ العرض").waitFor();
await page.screenshot({ path: `${out}/upsells-page.png` });

// Order on the store page → offer on the success screen → add it.
const site = await browser.newPage({ viewport: { width: 390, height: 844 } });
await site.goto("http://demo-store-2857.localhost:3000/", { waitUntil: "networkidle" });
const form = site.locator("form").filter({ has: site.locator("select") }).first();
await form.scrollIntoViewIfNeeded();
await form.getByLabel(/^الاسم/).fill("عميل العرض");
await form.getByLabel(/^رقم الموبايل/).fill(`010${String(Date.now()).slice(-8)}`);
await form.locator("select").first().selectOption("الجيزة");
await form.getByLabel(/^العنوان بالتفصيل/).fill("شارع الهرم 5");
// Required options: first value of each radio group (color, size).
for (const group of await form.getByRole("radiogroup").all()) {
  await group.getByRole("radio").first().click();
}
await site.waitForTimeout(3500);
await form.getByRole("button", { name: /تأكيد الطلب/ }).click();
const add = site.getByRole("button", { name: "أضفه لطلبي" });
await add.waitFor({ timeout: 15000 }).catch(async () => {
  console.log("form text:", (await site.locator("body").innerText()).slice(0, 400));
  throw new Error("no upsell card");
});
await add.scrollIntoViewIfNeeded();
await site.screenshot({ path: `${out}/success-offer.png` });
await add.click();
await site.getByText(/اتضاف لطلبك/).waitFor();
console.log("after add:", (await site.getByText(/اتضاف لطلبك/).textContent()).trim());
await site.screenshot({ path: `${out}/success-added.png` });
console.log("errors:", errors);
await browser.close();
