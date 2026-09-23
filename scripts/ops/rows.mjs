/**
 * Which category rows the homepage actually renders, and what is in them.
 *
 * The rows are built per master category and filled to PRODUCTS_PER_ROW, and
 * they arrive as the reader scrolls. Counting cards in the served HTML says
 * nothing about that, so this scrolls to the real bottom and then reports the
 * rows it found and the first cards in each.
 *
 *   node scripts/ops/rows.mjs [url] [match]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://softwarevala.net/";
const match = process.argv[3] ?? "";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(5000);

let previous = 0;
for (let i = 0; i < 45; i++) {
  const height = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return document.documentElement.scrollHeight;
  });
  if (height === previous && i > 12) break;
  previous = height;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(3000);

const out = await page.evaluate((needle) => {
  const headings = Array.from(document.querySelectorAll("h3")).map((h) => h.textContent.trim());
  const distinct = [...new Set(headings)];
  const html = document.body.innerHTML;
  return {
    docHeight: document.documentElement.scrollHeight,
    total: headings.length,
    distinct: distinct.length,
    containsNeedle: needle ? html.includes(needle) : null,
    matching: needle ? distinct.filter((d) => d.toLowerCase().includes(needle.toLowerCase())) : [],
    first: distinct.slice(0, 50),
  };
}, match);

await browser.close();

console.log(`url        : ${url}`);
console.log(`doc height : ${out.docHeight}px`);
console.log(`h3         : ${out.total} total, ${out.distinct} distinct`);
if (match) {
  console.log(`\ncontains "${match}" anywhere in the DOM: ${out.containsNeedle}`);
  console.log(`distinct headings containing it (${out.matching.length}):`);
  for (const m of out.matching.slice(0, 20)) console.log(`  ${m}`);
}
console.log(`\nfirst ${out.first.length} distinct headings:`);
out.first.forEach((h, i) => console.log(`  ${String(i + 1).padStart(2)}. ${h}`));
