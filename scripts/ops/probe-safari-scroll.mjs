/**
 * Why the catalogue stops paging on WebKit.
 *
 * On an iPad the home page renders its first ten rails and never loads another,
 * where Chromium at the same width reaches eighteen. The rows arrive from an
 * IntersectionObserver watching a one-pixel sentinel at the foot of the list,
 * and the rails above it carry `content-visibility: auto`. This measures each
 * part of that rather than reasoning about it: whether the sentinel is in the
 * document, where it actually sits, whether an observer on it reports an
 * intersection, and whether the document grows when the page is scrolled.
 *
 *   node scripts/ops/probe-safari-scroll.mjs [chromium|webkit] [url]
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

const catalogCalls = [];
page.on("request", (r) => {
  if (r.url().includes("/api/marketplace/catalog")) catalogCalls.push(r.url().split("?")[1] ?? "");
});

console.log(`engine: ${engine}\nurl   : ${url}\n`);
await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(3000);

const before = await page.evaluate(() => {
  const sentinel = document.querySelector('[aria-hidden="true"].h-px');
  const rails = document.querySelectorAll("[data-product-row]");
  const doc = document.documentElement;
  return {
    rails: rails.length,
    sentinelFound: Boolean(sentinel),
    sentinelRect: sentinel ? JSON.parse(JSON.stringify(sentinel.getBoundingClientRect())) : null,
    docScrollHeight: doc.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    innerHeight: window.innerHeight,
    // Is the browser skipping the rails' contents, and does it own up to it?
    railContentVisibility: rails.length
      ? getComputedStyle(rails[0]).getPropertyValue("content-visibility")
      : "(no rail)",
    railIntrinsic: rails.length
      ? getComputedStyle(rails[0]).getPropertyValue("contain-intrinsic-size")
      : "(no rail)",
    supportsContentVisibility: CSS.supports("content-visibility", "auto"),
  };
});
console.log("on load:");
for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(24)} ${JSON.stringify(v)}`);

// Does an observer of our own, on the page's own sentinel, ever fire?
const observed = await page.evaluate(async () => {
  const sentinel = document.querySelector('[aria-hidden="true"].h-px');
  if (!sentinel) return "no sentinel to observe";
  return await new Promise((resolve) => {
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        fired = true;
        resolve(
          `fired: isIntersecting=${entries[0].isIntersecting} ratio=${entries[0].intersectionRatio}`,
        );
      },
      { rootMargin: "600px" },
    );
    io.observe(sentinel);
    // Scroll it into range while the observer is live.
    setTimeout(() => sentinel.scrollIntoView({ block: "end" }), 200);
    setTimeout(() => { if (!fired) resolve("never fired within 5s"); }, 5000);
  });
});
console.log(`\nour own observer on the page's sentinel:\n  ${observed}`);

console.log("\nscrolling to the bottom, ten steps:");
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    window.scrollTo(0, h);
  });
  await page.waitForTimeout(900);
}

const after = await page.evaluate(() => ({
  rails: document.querySelectorAll("[data-product-row]").length,
  docScrollHeight: document.documentElement.scrollHeight,
  scrollY: window.scrollY,
  atBottom:
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 5,
}));
console.log("after scrolling:");
for (const [k, v] of Object.entries(after)) console.log(`  ${k.padEnd(24)} ${JSON.stringify(v)}`);

console.log(`\n/api/marketplace/catalog requests made: ${catalogCalls.length}`);
for (const c of catalogCalls.slice(0, 6)) console.log(`  ${c}`);

await browser.close();
