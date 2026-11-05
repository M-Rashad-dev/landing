import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

// Prints the Arabic report to PDF with Chromium (correct shaping and RTL), with page numbers.
const [input, output] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(input).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: output,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: '<div style="width:100%;font-size:8px;color:#8a8fa3;text-align:center;font-family:Arial">— <span class="pageNumber"></span> / <span class="totalPages"></span> —</div>',
});
await browser.close();
console.log("ok");
