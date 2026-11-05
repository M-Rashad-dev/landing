import { chromium } from "@playwright/test";

const APP = "http://app.localhost:3000";
const out = process.argv[2];
const stamp = Date.now();
const browser = await chromium.launch();

async function shoot(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "ar-EG" });
  const page = await context.newPage();
  // Node cannot resolve *.localhost here, so API calls run inside the browser.
  await page.goto(`${APP}/login`);
  const post = (path, data) =>
    page.evaluate(async ([path, data]) => {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return `${res.status} ${await res.text()}`;
    }, [path, data]);
  const reg = await post("/api/auth/register", { name: "Shot", email: `shot${stamp}${width}@example.com`, phone: `0101${String(stamp + width).slice(-7)}`, store_name: "Shot Store", password: "secret-pass-1", password_confirmation: "secret-pass-1" });
  if (!reg.startsWith("201") && !reg.startsWith("200")) throw new Error(`register ${reg}`);
  console.log(await post("/api/bff/dashboard/domains/custom", { host: `brand${stamp}${width}.localtest.me` }).then((r) => r.slice(0, 3)));
  console.log(await post("/api/bff/dashboard/domains/custom", { host: `shop.not-pointed-${stamp}.com` }).then((r) => r.slice(0, 3)));

  await page.goto(`${APP}/dashboard/domains`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/domains-${width}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`width ${width}: horizontal overflow ${overflow}px`);

  await page.getByRole("button", { name: "ربط دومين" }).click();
  await page.locator("#d_host").fill(`https://WWW.Example-${stamp}.com.eg/offer`);
  await page.screenshot({ path: `${out}/wizard1-${width}.png` });
  await page.getByRole("button", { name: "متابعة" }).click();
  await page.getByText("القيمة (Value)").waitFor();
  await page.screenshot({ path: `${out}/wizard2-${width}.png` });
  await page.getByRole("button", { name: "التالي" }).click();
  await page.screenshot({ path: `${out}/wizard3-${width}.png` });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "تغيير الاسم" }).click();
  await page.locator("#sub_label").fill(`new-name-${width}`);
  await page.getByText("الاسم متاح").waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${out}/rename-${width}.png` });
  await context.close();
}

await shoot(1280);
await shoot(390);
await browser.close();
