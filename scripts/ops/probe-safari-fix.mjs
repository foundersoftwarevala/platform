/**
 * Does removing paint containment restore the catalogue's paging on WebKit?
 *
 * Established: `.mpc-home section { contain: layout style paint }` puts the
 * catalogue's sentinel inside a paint-contained ancestor, and WebKit reports
 * no IntersectionObserver entry for anything inside such a section - at any
 * height, while the same observer works on an element in <body>.
 *
 * This checks the remedy before it is written into the stylesheet: the live
 * page is loaded twice in the same browser, once untouched and once with the
 * containment relaxed to `layout style`, and both are scrolled to the bottom.
 * The measure is the one that matters to a visitor - how many rails they can
 * reach, and whether the catalogue is asked for more.
 *
 *   node scripts/ops/probe-safari-fix.mjs [webkit|chromium]
 */
import { chromium, webkit, devices } from "@playwright/test";

const engine = process.argv[2] === "chromium" ? "chromium" : "webkit";
const url = process.argv[3] ?? "https://softwarevala.net/";
const launcher = engine === "chromium" ? chromium : webkit;
const browser = await launcher.launch();

async function run(relaxContainment) {
  const context = await browser.newContext(
    engine === "webkit" ? devices["iPad (gen 7)"] : { viewport: { width: 820, height: 1180 } },
  );
  const page = await context.newPage();
  const calls = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/marketplace/catalog")) calls.push(r.url());
  });

  if (relaxContainment) {
    // Applied before anything renders, so the page never has the containment.
    await page.addStyleTag({
      content: `.mpc-home section, .mpc-home header { contain: layout style !important; }`,
    }).catch(() => {});
    await page.addInitScript(() => {
      const css = ".mpc-home section, .mpc-home header { contain: layout style !important; }";
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = css;
        document.head.appendChild(s);
      });
    });
  }

  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  if (relaxContainment) {
    await page.addStyleTag({
      content: `.mpc-home section, .mpc-home header { contain: layout style !important; }`,
    });
  }
  await page.waitForTimeout(2000);

  const before = await page.evaluate(() => ({
    rails: document.querySelectorAll("[data-product-row]").length,
    contain: getComputedStyle(document.querySelector("section#all") ?? document.body).contain,
  }));

  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      window.scrollTo(0, h);
    });
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => ({
    rails: document.querySelectorAll("[data-product-row]").length,
    cards: document.querySelectorAll(".sv-card-shell").length,
  }));

  await context.close();
  return { ...before, ...after, calls: calls.length };
}

console.log(`engine: ${engine}\nurl   : ${url}\n`);
const asIs = await run(false);
console.log("as the page ships:");
console.log(`  section#all contain      ${asIs.contain}`);
console.log(`  rails on load            ${asIs.rails}`);
console.log(`  rails after scrolling    ${asIs.rails}`);
console.log(`  cards after scrolling    ${asIs.cards}`);
console.log(`  catalogue requests       ${asIs.calls}`);

const fixed = await run(true);
console.log("\nwith `contain: layout style` (paint removed):");
console.log(`  section#all contain      ${fixed.contain}`);
console.log(`  rails after scrolling    ${fixed.rails}`);
console.log(`  cards after scrolling    ${fixed.cards}`);
console.log(`  catalogue requests       ${fixed.calls}`);

await browser.close();

console.log(`\n=== verdict ===`);
if (fixed.rails > asIs.rails || fixed.calls > asIs.calls) {
  console.log(`  removing paint containment restores paging: ${asIs.rails} -> ${fixed.rails} rails, ${asIs.calls} -> ${fixed.calls} requests.`);
  process.exit(0);
}
console.log("  no change. Paint containment is not the whole cause; do not ship this.");
process.exit(1);
