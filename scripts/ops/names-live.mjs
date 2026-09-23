/**
 * Are the named products actually on the page?
 *
 * Takes the ids' display names straight out of the seed file and asks the live
 * DOM for each one, so a miss means the row did not render that card - not that
 * the probe stopped scrolling too early.
 *
 *   node scripts/ops/names-live.mjs <id-prefix> [url]
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const prefix = process.argv[2] ?? "re-";
const url = process.argv[3] ?? "https://softwarevala.net/";

const source = readFileSync("src/data/extraDemos.ts", "utf8");
const names = [...source.matchAll(/mk\(\s*"([^"]+)",\s*"([^"]+)"/g)]
  .filter(([, id]) => id.startsWith(prefix))
  .map(([, , name]) => name);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(5000);

let previous = 0;
for (let i = 0; i < 60; i++) {
  const height = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return document.documentElement.scrollHeight;
  });
  if (height === previous && i > 15) break;
  previous = height;
  await page.waitForTimeout(400);
}
await page.waitForTimeout(3000);

const found = await page.evaluate(() => {
  const set = new Set();
  for (const h of document.querySelectorAll("h3")) set.add(h.textContent.trim());
  return [...set];
}, null);

await browser.close();

const present = names.filter((n) => found.includes(n));
const missing = names.filter((n) => !found.includes(n));
console.log(`prefix   : ${prefix}`);
console.log(`in source: ${names.length}`);
console.log(`on page  : ${present.length}`);
console.log(`missing  : ${missing.length}`);
for (const m of missing) console.log(`  - ${m}`);
