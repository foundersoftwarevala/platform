/**
 * What a visitor actually waits for.
 *
 * Paint and load timings as the browser reports them, plus what the page costs
 * once it is there: how many requests, how much transferred, how large the DOM
 * gets. Run twice - cold and warm - because this origin renders every page and
 * holds its catalogue for a minute, so the two are different questions.
 *
 *   node scripts/ops/bench-page.mjs [url]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://softwarevala.net/";

async function run(label, context) {
  const page = await context.newPage();
  let requests = 0;
  let transferred = 0;
  const failed = [];
  page.on("response", async (r) => {
    requests++;
    const len = Number(r.headers()["content-length"] ?? 0);
    if (len) transferred += len;
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url().split("/").pop()}`);
  });

  const started = Date.now();
  await page.goto(url, { waitUntil: "load", timeout: 90_000 });

  const paint = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const out = {};
        for (const e of performance.getEntriesByType("paint")) out[e.name] = Math.round(e.startTime);
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav) {
          out.ttfb = Math.round(nav.responseStart);
          out.domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
          out.load = Math.round(nav.loadEventEnd);
          out.transferSize = nav.transferSize;
        }
        // LCP arrives after load; give it a moment to settle.
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            out.lcp = Math.round(entries[entries.length - 1].startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch { /* not supported */ }
        setTimeout(() => resolve(out), 2500);
      }),
  );

  await page.waitForTimeout(4000);
  const dom = await page.evaluate(() => ({
    nodes: document.getElementsByTagName("*").length,
    rails: document.querySelectorAll("[data-product-row]").length,
    cards: document.querySelectorAll(".sv-card-shell").length,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  }));

  await page.close();
  return { label, wall: Date.now() - started, ...paint, requests, transferred, failed, ...dom };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const cold = await run("cold (empty cache)", context);
const warm = await run("warm (same context)", context);
await browser.close();

const show = (r) => {
  console.log(`\n=== ${r.label} ===`);
  console.log(`  TTFB               ${r.ttfb ?? "?"} ms`);
  console.log(`  First Paint        ${r["first-paint"] ?? "?"} ms`);
  console.log(`  FCP                ${r["first-contentful-paint"] ?? "?"} ms`);
  console.log(`  LCP                ${r.lcp ?? "not reported"} ms`);
  console.log(`  DOMContentLoaded   ${r.domContentLoaded ?? "?"} ms`);
  console.log(`  load               ${r.load ?? "?"} ms`);
  console.log(`  document transfer  ${r.transferSize ? Math.round(r.transferSize / 1024) + " KB" : "?"}`);
  console.log(`  requests           ${r.requests}`);
  console.log(`  content-length sum ${Math.round(r.transferred / 1024)} KB`);
  console.log(`  DOM nodes          ${r.nodes}`);
  console.log(`  rails / cards      ${r.rails} / ${r.cards}`);
  console.log(`  JS heap            ${r.heapMB != null ? r.heapMB + " MB" : "not reported"}`);
  console.log(`  failed requests    ${r.failed.length ? r.failed.join(", ") : "none"}`);
};

console.log(`page: ${url}`);
show(cold);
show(warm);
