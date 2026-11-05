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

// Dashboard: enable, default 50, free over 2000, Aswan 90, North Sinai closed.
await page.goto("http://app.localhost:3000/dashboard/shipping");
await page.getByRole("switch", { name: "تفعيل مصاريف الشحن" }).click();
await page.locator("#ship-default").fill("50");
await page.locator("#ship-free").fill("2000");
await page.getByLabel("سعر خاص — أسوان").fill("90");
await page.getByRole("switch", { name: "التوصيل متاح — شمال سيناء" }).click();
await page.getByRole("button", { name: "حفظ" }).click();
await page.getByText("تم حفظ إعدادات الشحن").waitFor();
await page.screenshot({ path: `${out}/shipping-settings.png` });

// Store page: pick a governorate, the summary shows the fee (revalidated through the queue).
const site = await browser.newPage({ viewport: { width: 390, height: 844 } });
let closedDisabled = false;
for (let i = 0; i < 20 && !closedDisabled; i++) {
  await site.goto("http://demo-store-2857.localhost:3000/", { waitUntil: "networkidle" });
  closedDisabled = await site.locator('select option[value="شمال سيناء"]').first().isDisabled().catch(() => false);
  if (!closedDisabled) await site.waitForTimeout(1000);
}
console.log("North Sinai disabled:", closedDisabled);
const form = site.locator("form").filter({ has: site.locator("select") }).first();
await form.scrollIntoViewIfNeeded();
await form.locator("button").filter({ hasText: /أسود|فضي/ }).first().click().catch(() => undefined);
await form.locator("button").filter({ hasText: /42 مم/ }).first().click().catch(() => undefined);
await form.locator("select").first().selectOption("أسوان");
await site.waitForTimeout(1500);
const summary = await form.innerText();
console.log("shipping line:", summary.split("\n").filter((l) => /الشحن|الإجمالي/.test(l)).join(" | "));
await form.screenshot({ path: `${out}/order-form-shipping.png` });

// Put the demo back: shipping off.
await page.getByRole("switch", { name: "تفعيل مصاريف الشحن" }).click();
await page.getByRole("button", { name: "حفظ" }).click();
console.log("errors:", errors);
await browser.close();
