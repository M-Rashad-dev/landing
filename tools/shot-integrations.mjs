import { chromium } from "@playwright/test";

// Integrations screen: Sheets setup steps, add a webhook through the dialog, send a test, read the log.
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

const call = (path, method = "GET") => page.evaluate(async ({ path, method }) => (await fetch(`/api/bff${path}`, { method })).json().catch(() => null), { path, method });
for (const item of (await call("/dashboard/integrations"))?.data ?? []) await call(`/dashboard/integrations/${item.id}`, "DELETE");

await page.getByRole("link", { name: "Google Sheets و Webhooks" }).click();
await page.waitForURL("**/dashboard/integrations");
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/integrations-empty.png`, fullPage: true });

// Wrong Sheets link → clear message.
await page.locator("#sheets-url").fill("https://docs.google.com/spreadsheets/d/abc");
await page.getByRole("button", { name: "ربط الشيت" }).click();
console.log("sheets error:", (await page.getByText("ده مش رابط Apps Script").first().textContent())?.slice(0, 60));

// Webhook to a private address is refused when saving; a public one is saved.
await page.getByRole("button", { name: "إضافة Webhook" }).click();
await page.locator("#wh-name").fill("نظام الشحن");
await page.locator("#wh-url").fill("https://192.168.1.20/hook");
await page.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
console.log("private error:", await page.getByText("مينفعش نبعت لعنوان داخلي").first().isVisible());
await page.locator("#wh-url").fill("https://example.com/webhooks/orders");
await page.getByRole("dialog").getByRole("switch", { name: "تغيير حالة الطلب" }).click();
await page.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
await page.getByText("تم الحفظ").waitFor();

// Real outgoing request (example.com answers, but not with 2xx for POST) → logged with its code.
await page.getByRole("button", { name: "إرسال تجربة" }).click();
await page.waitForTimeout(6000);
await page.getByRole("button", { name: "آخر الإرسالات" }).click();
await page.waitForTimeout(1200);
console.log("log:", (await page.locator("ul.divide-y li").first().innerText().catch(() => "none")).replace(/\s+/g, " "));
await page.locator("details summary").click();
await page.screenshot({ path: `${out}/integrations-webhook.png`, fullPage: true });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.context().addCookies(await page.context().cookies());
await mobile.goto("http://app.localhost:3000/dashboard/integrations");
await mobile.waitForTimeout(1500);
console.log("mobile overflow:", await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
await mobile.screenshot({ path: `${out}/integrations-mobile.png`, fullPage: true });
await browser.close();
console.log("errors:", errors.length ? errors : "none");
