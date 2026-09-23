/**
 * Does an IntersectionObserver report the foot of this page at all on WebKit?
 *
 * The earlier probe resolved on the observer's first callback, which always
 * arrives with the element's state at the moment it is observed - before any
 * scrolling - so it proved nothing. This one records every callback while the
 * page is scrolled to the bottom, and reports what the observer said and when.
 *
 * It also watches a plain element of its own, appended at the foot of the
 * document, so the page's sentinel and a control element are measured under
 * the same conditions. If the control is reported and the sentinel is not, the
 * difference is the sentinel or what surrounds it; if neither is, it is the
 * observer.
 *
 *   node scripts/ops/probe-safari-observer.mjs [webkit|chromium]
 */
import { chromium, webkit, devices } from "@playwright/test";

const engine = process.argv[2] === "chromium" ? "chromium" : "webkit";
const url = process.argv[3] ?? "https://softwarevala.net/";
const launcher = engine === "chromium" ? chromium : webkit;

const browser = await launcher.launch();
const context = await browser.newContext(
  engine === "webkit" ? devices["iPad (gen 7)"] : { viewport: { width: 820, height: 1180 } },
);
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(2500);

// Arm both observers, then scroll, then read what they recorded.
await page.evaluate(() => {
  const w = window;
  w.__probe = { sentinel: [], control: [], sentinelFound: false };

  const sentinel = document.querySelector('[aria-hidden="true"].h-px');
  w.__probe.sentinelFound = Boolean(sentinel);
  if (sentinel) {
    new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          w.__probe.sentinel.push({
            t: Math.round(performance.now()),
            hit: e.isIntersecting,
            ratio: Number(e.intersectionRatio.toFixed(3)),
            top: Math.round(e.boundingClientRect.top),
          });
        }
      },
      { rootMargin: "600px" },
    ).observe(sentinel);
  }

  // A control: an ordinary div with height, at the very end of the document.
  const control = document.createElement("div");
  control.id = "probe-control";
  control.style.cssText = "height:8px;width:100%";
  document.body.appendChild(control);
  new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        w.__probe.control.push({
          t: Math.round(performance.now()),
          hit: e.isIntersecting,
          ratio: Number(e.intersectionRatio.toFixed(3)),
          top: Math.round(e.boundingClientRect.top),
        });
      }
    },
    { rootMargin: "600px" },
  ).observe(control);
});

for (let i = 0; i < 8; i++) {
  await page.evaluate(() => {
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    window.scrollTo(0, h);
  });
  await page.waitForTimeout(800);
}
await page.waitForTimeout(1500);

const probe = await page.evaluate(() => window.__probe);
await browser.close();

console.log(`engine: ${engine}\n`);
console.log(`page sentinel present: ${probe.sentinelFound}`);
console.log(`\ncallbacks for the page's own sentinel (${probe.sentinel.length}):`);
for (const c of probe.sentinel) console.log(`  t=${c.t}ms  intersecting=${c.hit}  ratio=${c.ratio}  top=${c.top}px`);
console.log(`\ncallbacks for a plain control div at the foot of the body (${probe.control.length}):`);
for (const c of probe.control) console.log(`  t=${c.t}ms  intersecting=${c.hit}  ratio=${c.ratio}  top=${c.top}px`);

const sHit = probe.sentinel.some((c) => c.hit);
const cHit = probe.control.some((c) => c.hit);
console.log(`\n=== verdict ===`);
console.log(`  page's sentinel ever reported intersecting : ${sHit}`);
console.log(`  control div ever reported intersecting     : ${cHit}`);
if (!sHit && cHit) console.log("  -> the observer works here; the sentinel is what is never seen.");
else if (!sHit && !cHit) console.log("  -> nothing at the foot of this document is reported, observer included.");
else if (sHit) console.log("  -> the sentinel IS reported; the paging must be stopping somewhere after it.");
