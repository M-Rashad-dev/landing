import { chromium } from "@playwright/test";

const out = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto("http://app.localhost:3000/login");
await page.locator("#login").fill("demo@example.com");
await page.locator("#password").fill("demo-pass-123");
await page.getByRole("button", { name: "دخول" }).click();
await page.waitForURL("**/dashboard");

// Ids of three demo orders from the API.
const ids = await page.evaluate(async () => (await (await fetch("/api/bff/dashboard/orders?per_page=3")).json()).data.map((o) => o.id));
console.log("ids", ids);

await page.goto(`http://app.localhost:3000/dashboard/orders/print?ids=${ids.join(",")}`);
await page.locator("article svg rect").first().waitFor({ timeout: 15000 });
await page.screenshot({ path: `${out}/invoice-a4.png`, fullPage: false });
await page.emulateMedia({ media: "print" });
await page.pdf({ path: `${out}/invoices-a4.pdf`, preferCSSPageSize: true, printBackground: true });
await page.emulateMedia({ media: "screen" });

await page.getByRole("radio", { name: /A6/ }).click();
await page.locator("article svg rect").first().waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/invoice-a6.png` });
await page.emulateMedia({ media: "print" });
await page.pdf({ path: `${out}/labels-a6.pdf`, preferCSSPageSize: true, printBackground: true });
await browser.close();
