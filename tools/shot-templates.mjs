import { chromium } from "@playwright/test";

// Template gallery → wizard → create one page per template → publish → public page screenshot.
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

await page.getByRole("link", { name: "القوالب الجاهزة" }).click();
await page.waitForURL("**/dashboard/pages/templates");
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/templates-gallery.png`, fullPage: true });

const call = (path, method = "GET", body) =>
  page.evaluate(
    async ({ path, method, body }) => {
      const res = await fetch(`/api/bff${path}`, { method, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    { path, method, body },
  );

const niches = ["موضة وملابس", "تجميل وعناية", "إلكترونيات وإكسسوارات", "المنزل والمطبخ", "أطفال وألعاب", "صحة ورياضة"];
const created = [];
for (const [i, niche] of niches.entries()) {
  await page.goto("http://app.localhost:3000/dashboard/pages/templates");
  const card = page.locator("div.group").filter({ hasText: niche }).first();
  await card.getByRole("link", { name: "استخدم القالب" }).click();
  await page.waitForURL("**/dashboard/pages/new?template=*");
  await page.locator("#wiz-title").fill(`قالب ${niche}`);
  const slug = `tpl-${Date.now().toString(36)}-${i}`;
  await page.locator("#wiz-slug").fill(slug);
  await page.locator("#wiz-product").click();
  await page.getByRole("option", { name: /ساعة ذكية رياضية/ }).first().click();
  if (i === 0) await page.screenshot({ path: `${out}/wizard-template.png` });
  await page.getByRole("button", { name: "إنشاء وفتح المحرر" }).click();
  await page.waitForURL("**/builder", { timeout: 20000 });
  const id = page.url().match(/pages\/(\d+)\/builder/)[1];
  if (i === 1) {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/builder-template.png` });
  }
  const published = await call(`/dashboard/pages/${id}/publish`, "POST");
  if (published.status !== 200) throw new Error(`publish ${niche}: ${published.status} ${JSON.stringify(published.json).slice(0, 300)}`);
  created.push({ niche, slug });
}
console.log("created:", created.map((c) => c.slug).join(", "));

for (const [i, { slug }] of created.entries()) {
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", (e) => errors.push(String(e)));
  const res = await mobile.goto(`http://demo-store-2857.localhost:3000/${slug}`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(700);
  await mobile.screenshot({ path: `${out}/tpl-${i}.png` });
  console.log(slug, res.status(), (await mobile.locator("h1").first().textContent())?.trim());
  await mobile.close();
}
await browser.close();
console.log("errors:", errors.length ? errors : "none");
