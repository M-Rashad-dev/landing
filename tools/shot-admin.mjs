import { chromium } from "@playwright/test";

const out = process.argv[2];
const browser = await chromium.launch();
for (const width of [1280, 390]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  const step = (name) => console.log(width, name);
  await page.goto("http://app.localhost:3000/login");
  await page.locator("#login").fill("admin@example.com");
  await page.locator("#password").fill("demo-pass-123");
  await page.getByRole("button", { name: "دخول" }).click();
  await page.waitForURL("**/admin");
  await page.getByText("الصفحات المنشورة").waitFor();
  step("overview");
  await page.screenshot({ path: `${out}/admin-${width}.png`, fullPage: true });

  await page.goto("http://app.localhost:3000/admin/tenants");
  await page.getByText("Demo Store").locator("visible=true").first().waitFor();
  step("tenants");
  await page.screenshot({ path: `${out}/tenants-${width}.png`, fullPage: true });
  console.log(width, "overflow", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));

  await page.getByText("Demo Store").locator("visible=true").first().click();
  await page.waitForURL(/\/admin\/tenants\/\d+$/);
  await page.getByText("بيانات المتجر").waitFor();
  step("tenant");
  await page.screenshot({ path: `${out}/tenant-${width}.png`, fullPage: true });

  await page.goto("http://app.localhost:3000/admin/themes");
  await page.getByRole("switch").first().waitFor();
  step("themes");
  await page.screenshot({ path: `${out}/themes-${width}.png` });
}
await browser.close();
