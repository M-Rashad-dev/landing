import { chromium } from "@playwright/test";

const out = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://app.localhost:3000/login");
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");
await page.goto("http://app.localhost:3000/dashboard/pages");
const href = await page.locator('a[href*="/builder"]').first().getAttribute("href");
await page.goto(`http://app.localhost:3000${href}`);
const frame = page.frameLocator("iframe").first();
await frame.locator("[data-theme]").first().waitFor();
const primary = () => frame.locator("[data-theme]").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--c-primary").trim());
console.log("before:", await primary());

// Device morph: width mid-transition.
const iframeBox = () => page.locator("iframe").first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
const w0 = await iframeBox();
await page.getByRole("radio", { name: "موبايل" }).click();
await page.waitForTimeout(200);
const wMid = await iframeBox();
await page.waitForTimeout(500);
const wEnd = await iframeBox();
console.log(`device morph: ${w0} → ${wMid} (mid) → ${wEnd}`);
await page.screenshot({ path: `${out}/builder-mobile.png` });
await page.getByRole("radio", { name: "ديسكتوب" }).click();
await page.waitForTimeout(600);

// Custom page identity → palette → preview updates live.
await page.getByRole("radio", { name: /خاصة بالصفحة/ }).click();
await page.getByRole("button", { name: "ليلي" }).click();
await page.waitForTimeout(500);
console.log("after palette:", await primary());
await page.screenshot({ path: `${out}/builder-custom.png` });

// Save + publish, then the public page uses the design.
await page.getByRole("button", { name: "نشر", exact: true }).click();
await page.getByRole("dialog").getByText("تم نشر الصفحة").waitFor();
const url = (await page.getByRole("dialog").locator("p, a, code, span").filter({ hasText: /^http/ }).first().textContent()).trim();
const site = await browser.newPage({ viewport: { width: 390, height: 844 } });
let livePrimary = "";
for (let i = 0; i < 15 && livePrimary !== "#F5C542"; i++) {
  await site.goto(url, { waitUntil: "networkidle" });
  livePrimary = await site.locator("[data-theme]").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--c-primary").trim());
  if (livePrimary !== "#F5C542") await site.waitForTimeout(1000);
}
console.log("public page primary:", livePrimary, url);
await site.screenshot({ path: `${out}/public-custom.png` });

// Back to the saved identity and republish (leave the demo as it was).
await page.keyboard.press("Escape");
await page.getByRole("radio", { name: /هوية محفوظة/ }).click();
await page.getByRole("button", { name: "نشر", exact: true }).click();
await page.getByRole("dialog").getByText("تم نشر الصفحة").waitFor();
console.log("restored:", await primary());
await browser.close();
