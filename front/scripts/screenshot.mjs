// Dev helper: full-page screenshots for visual review.
// node scripts/screenshot.mjs <url> <out.png> [width] [cookie]
import { chromium } from "@playwright/test";

const [, , url, out, width = "390", cookie] = process.argv;
if (!url || !out) {
  console.error("usage: node scripts/screenshot.mjs <url> <out.png> [width] [lp_token]");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 1, locale: "ar-EG" });
if (cookie) {
  const { hostname } = new URL(url);
  await context.addCookies([{ name: "lp_token", value: cookie, domain: hostname, path: "/" }]);
}
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => message.type() === "error" && !message.text().startsWith("Failed to load resource") && errors.push(message.text()));
page.on("response", (response) => response.status() >= 400 && errors.push(`${response.status()} ${response.url().slice(0, 120)}`));
await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(800);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const chunk = Number(process.env.CHUNK || 0);
const files = [];
if (chunk > 0) {
  // Slices of `chunk` px height (readable thumbnails of long pages).
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const from = Number(process.env.FROM || 0);
  const to = Math.min(height, Number(process.env.TO || height));
  for (let y = from, i = 0; y < to; y += chunk, i++) {
    const file = out.replace(/\.png$/, `-${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y, width: Number(width), height: Math.min(chunk, to - y) } });
    files.push(file);
  }
} else {
  await page.screenshot({ path: out, fullPage: true });
  files.push(out);
}
console.log(JSON.stringify({ files, width: Number(width), horizontalOverflow: overflow, errors }));
await browser.close();
