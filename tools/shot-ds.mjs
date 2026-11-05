import { chromium } from "@playwright/test";

const out = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://app.localhost:3000/login");
await page.screenshot({ path: `${out}/login.png` });
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/home.png`, fullPage: true });

await page.goto("http://app.localhost:3000/dashboard/orders");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/orders.png` });
const filters = page.getByRole("button", { name: /فلاتر|تصفية/ });
if (await filters.count()) {
  await filters.first().click();
  await page.waitForTimeout(400);
  await page.locator("button[role=combobox]").first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/select-open.png` });
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "من تاريخ" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/date-open.png` });
  await page.keyboard.press("Escape");
}

await page.goto("http://app.localhost:3000/dashboard/products/new");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/product-form.png`, fullPage: true });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
const m = await mobile.newPage();
await m.goto("http://app.localhost:3000/dashboard");
await m.waitForTimeout(1500);
await m.screenshot({ path: `${out}/mobile-home.png` });
await m.getByRole("button", { name: "فتح القائمة" }).click();
await m.waitForTimeout(600);
await m.screenshot({ path: `${out}/mobile-menu.png` });
await browser.close();
