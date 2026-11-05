import { chromium } from "@playwright/test";

const out = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://app.localhost:3000/login");
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");

await page.goto("http://app.localhost:3000/dashboard/orders/confirm");
const current = page.locator("[data-queue-current] h2");
await current.waitFor();
const first = await current.textContent();
console.log("current:", first.trim());
await page.screenshot({ path: `${out}/queue.png` });

// No answer → logged and moves to the next order.
await page.locator("[data-queue-current] [data-action=no-answer]").click();
await page.waitForFunction((before) => document.querySelector("[data-queue-current] h2")?.textContent?.trim() !== before, first.trim(), { timeout: 10000 });
console.log("after no-answer:", (await current.textContent()).trim());

// WhatsApp link carries the filled message.
const wa = await page.locator("[data-queue-current] a[href^='https://wa.me']").getAttribute("href");
console.log("whatsapp text:", decodeURIComponent(wa.split("text=")[1]).split("\n").slice(0, 2).join(" | "));

// Settings: template preview.
await page.goto("http://app.localhost:3000/dashboard/settings");
await page.locator("#wa-template").waitFor();
await page.locator("#wa-template").scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/settings-template.png`, fullPage: true });
console.log("errors:", errors);
await browser.close();
