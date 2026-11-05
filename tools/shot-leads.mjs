import { chromium } from "@playwright/test";

const out = process.argv[2];
const browser = await chromium.launch();
const errors = [];

// Visitor types name + phone on the store page, waits, then leaves without ordering.
const site = await browser.newPage({ viewport: { width: 390, height: 844 } });
site.on("pageerror", (e) => errors.push(String(e)));
await site.goto("http://demo-store-2857.localhost:3000/", { waitUntil: "networkidle" });
const form = site.locator("form").filter({ has: site.locator("select") }).first();
await form.scrollIntoViewIfNeeded();
await site.waitForTimeout(3500);
const phone = `011${String(Date.now()).slice(-8)}`;
const leadResponse = site.waitForResponse((r) => r.url().includes("/api/public/leads"));
await form.getByLabel(/^الاسم/).fill("سارة متروكة");
await form.getByLabel(/^رقم الموبايل/).fill(phone);
console.log("lead status:", (await leadResponse).status());
await site.close();

const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://app.localhost:3000/login");
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");
await page.getByRole("link", { name: "الطلبات المتروكة" }).click();
await page.getByText("سارة متروكة").first().waitFor();
await page.screenshot({ path: `${out}/leads-open.png` });
const wa = await page.getByRole("link", { name: "واتساب" }).first().getAttribute("href");
console.log("whatsapp:", decodeURIComponent(wa ?? "").slice(0, 160));
await page.getByRole("button", { name: "تم التواصل" }).first().click();
await page.getByText("تم التحديث").waitFor();
await page.getByRole("tab", { name: /تم التواصل/ }).click();
await page.getByText("سارة متروكة").first().waitFor();
await page.screenshot({ path: `${out}/leads-contacted.png` });
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.context().addCookies(await page.context().cookies());
await browser.close();
console.log("errors:", errors.length ? errors : "none");
