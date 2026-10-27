import { chromium, devices } from "@playwright/test";

// Phone + Lighthouse "slow 4G" (150 ms RTT, 1.6 Mbps down, 750 kbps up) + 4x CPU slowdown.
const urls = process.argv.slice(2);
const browser = await chromium.launch();

for (const url of urls) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({ ...devices["Pixel 7"] });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    let bytes = 0;
    page.on("response", async (response) => {
      const length = Number((await response.allHeaders())["content-length"] ?? 0);
      bytes += length;
    });

    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0, longTasks: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__perf.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perf.longTasks += Math.max(0, entry.duration - 50);
      }).observe({ type: "longtask", buffered: true });
    });

    await page.goto(url, { waitUntil: "load", timeout: 120_000 });
    await page.waitForTimeout(3000);
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return { ...window.__perf, ttfb: nav.responseStart, fcp: fcp?.startTime ?? 0 };
    });
    runs.push({ ...perf, bytes });
    await context.close();
  }
  const median = (key) => runs.map((r) => r[key]).sort((a, b) => a - b)[1];
  console.log(
    `${url}\n  median of 3: TTFB ${median("ttfb").toFixed(0)} ms · FCP ${median("fcp").toFixed(0)} ms · LCP ${median("lcp").toFixed(0)} ms · ` +
      `CLS ${median("cls").toFixed(3)} · long-task time ${median("longTasks").toFixed(0)} ms · transferred ${(median("bytes") / 1024).toFixed(0)} KB`,
  );
}

await browser.close();
