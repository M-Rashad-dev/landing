import { chromium } from "@playwright/test";

// «ليالي»: create a page from the luxury template through the wizard, publish, screenshot the
// public page (mobile + desktop), and switch a Malak page to Layali to check the night palette.
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

await page.goto("http://app.localhost:3000/dashboard/pages/new");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/layali-wizard.png` });
await page.getByRole("radio", { name: /عطور وهدايا فاخرة/ }).click();
await page.locator("#wiz-title").fill("عطر ليالي");
const slug = `layali-${Date.now().toString(36)}`;
await page.locator("#wiz-slug").fill(slug);
await page.locator("#wiz-product").click();
await page.getByRole("option", { name: /ساعة ذكية رياضية/ }).first().click();
await page.getByRole("button", { name: "إنشاء وفتح المحرر" }).click();
await page.waitForURL("**/builder", { timeout: 20000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/layali-builder.png` });
const id = page.url().match(/pages\/(\d+)\/builder/)[1];
const published = await page.evaluate(async (id) => (await fetch(`/api/bff/dashboard/pages/${id}/publish`, { method: "POST" })).status, id);
console.log("publish:", published, slug);

for (const [name, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 900 }]]) {
  const site = await browser.newPage({ viewport });
  site.on("pageerror", (e) => errors.push(String(e)));
  await site.goto(`http://demo-store-2857.localhost:3000/${slug}`, { waitUntil: "load" });
  await site.waitForTimeout(1500);
  await site.screenshot({ path: `${out}/layali-${name}-top.png` });
  for (const type of ["product_showcase", "features", "comparison", "order_form"]) {
    const el = site.locator(`[data-section-type="${type}"]`);
    await el.scrollIntoViewIfNeeded();
    await site.waitForTimeout(900);
    if (name === "mobile") await el.screenshot({ path: `${out}/layali-${type}.png` });
  }
  console.log(name, "overflow:", await site.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), "bg:", await site.evaluate(() => getComputedStyle(document.querySelector(".t-site")).backgroundColor));
  await site.close();
}
await browser.close();
console.log("errors:", errors.length ? errors : "none");
