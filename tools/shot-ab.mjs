import { chromium } from "@playwright/test";

// A/B test between two published template pages: create in the UI, split visitors under page A's
// link, keep the variant per visitor, order from B, then screenshot the analytics and A/B screens.
const out = process.argv[2];
const host = "http://demo-store-2857.localhost:3000";
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
  page.evaluate(
    async ({ path, method, body }) => {
      const res = await fetch(`/api/bff${path}`, { method, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    { path, method, body },
  );

// Clear old tests from earlier runs.
for (const test of (await call("/dashboard/ab-tests")).json.data) await call(`/dashboard/ab-tests/${test.id}`, "DELETE");
const pages = (await call("/dashboard/pages?status=published")).json.data;
const pageA = pages.find((p) => p.title === "قالب موضة وملابس");
const pageB = pages.find((p) => p.title === "قالب تجميل وعناية");
console.log("A:", pageA?.slug, "B:", pageB?.slug);

await page.getByRole("link", { name: "اختبارات A/B" }).click();
await page.waitForURL("**/dashboard/ab-tests");
await page.getByRole("button", { name: "اختبار جديد" }).first().click();
await page.locator("#ab-name").fill("موضة ضد تجميل");
await page.locator("#ab-a").click();
await page.getByRole("option", { name: new RegExp(`^${pageA.title}`) }).click();
await page.locator("#ab-b").click();
await page.getByRole("option", { name: new RegExp(`^${pageB.title}`) }).click();
await page.screenshot({ path: `${out}/ab-create.png` });
await page.getByRole("dialog").getByRole("button", { name: "اختبار جديد" }).click();
await page.getByText("بدأ الاختبار").waitFor();

// Wait for the proxy's 30 s route cache to pick it up.
await new Promise((r) => setTimeout(r, 2000));

const seen = { a: 0, b: 0 };
let sticky = true;
for (let i = 0; i < 16; i++) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const visitor = await context.newPage();
  visitor.on("pageerror", (e) => errors.push(String(e)));
  await visitor.goto(`${host}/${pageA.slug}`, { waitUntil: "load" });
  await visitor.waitForTimeout(400);
  const h1 = (await visitor.locator("h1").first().textContent())?.trim();
  const variant = h1?.includes("بشرة") ? "b" : "a";
  seen[variant]++;
  if (!visitor.url().endsWith(`/${pageA.slug}`)) sticky = false;
  await visitor.reload({ waitUntil: "load" });
  const again = (await visitor.locator("h1").first().textContent())?.trim();
  if (again !== h1) sticky = false;
  if (variant === "b" && seen.b === 1) {
    // One order from B through the real form.
    const form = visitor.locator("#order form");
    await form.scrollIntoViewIfNeeded();
    await visitor.waitForTimeout(3500);
    await form.getByLabel(/^الاسم/).fill("عميل الاختبار");
    await form.getByLabel(/^رقم الموبايل/).fill(`012${String(Date.now()).slice(-8)}`);
    const address = form.getByLabel(/^العنوان/);
    if (await address.count()) await address.first().fill("شارع التحرير 12");
    for (const group of await form.getByRole("radiogroup").all()) await group.getByRole("radio").first().click();
    const sel = form.locator("select");
    if (await sel.count()) await sel.first().selectOption({ index: 1 });
    await form.getByRole("button", { name: /تأكيد|اطلب/ }).last().click();
    await visitor.getByText(/تم استلام طلبك/).waitFor({ timeout: 15000 }).catch(async () => console.log("form:", (await form.innerText()).slice(0, 300)));
  }
  await context.close();
}
console.log("split:", JSON.stringify(seen), "same URL + same variant on reload:", sticky);

await page.reload();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/ab-list.png`, fullPage: true });
await page.getByRole("link", { name: "التحليلات" }).click();
await page.waitForURL("**/dashboard/analytics");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/analytics.png`, fullPage: true });
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.context().addCookies(await page.context().cookies());
await mobile.goto("http://app.localhost:3000/dashboard/ab-tests");
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: `${out}/ab-mobile.png`, fullPage: true });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log("mobile overflow:", overflow);
await browser.close();
console.log("errors:", errors.length ? errors : "none");
