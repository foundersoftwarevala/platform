/**
 * Are the named products actually on the page?
 *
 * Takes the ids' display names straight out of the seed file and asks the live
 * DOM for each one. The rows mount as the reader scrolls, so the walk down the
 * page only stops once the height has held still several checks running, and
 * the report carries that height and the row count - a miss with a short page
 * means the walk ended early, a miss on a full page means the row is broken.
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
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(5000);

// Each row mounts its cards when its own observer fires, so the walk has to
// pass through every screen of the page. Jumping to the bottom skips the rows
// in between and they stay empty.
let y = 0;
let still = 0;
for (let i = 0; i < 400 && still < 8; i++) {
  const at = await page.evaluate((top) => {
    window.scrollTo(0, top);
    return { height: document.documentElement.scrollHeight, view: window.innerHeight };
  }, y);
  const next = y + Math.round(at.view * 0.7);
  still = next >= at.height - at.view ? still + 1 : 0;
  y = Math.min(next, Math.max(0, at.height - at.view));
  await page.waitForTimeout(350);
}
await page.waitForTimeout(3000);

const seen = await page.evaluate(() => ({
  height: document.documentElement.scrollHeight,
  cards: [...document.querySelectorAll("h3")].map((h) => h.textContent.trim()),
  rows: document.querySelectorAll("[data-row-category]").length,
  h2: [...document.querySelectorAll("h2")].map((h) => h.textContent.trim().slice(0, 40)).length,
}));

await browser.close();

const found = new Set(seen.cards);
const present = names.filter((n) => found.has(n));
const missing = names.filter((n) => !found.has(n));
console.log(`prefix   : ${prefix}`);
console.log(`in source: ${names.length}`);
console.log(`on page  : ${present.length}`);
console.log(`missing  : ${missing.length}`);
console.log(`height   : ${seen.height}px   h3 total ${seen.cards.length}, distinct ${found.size}`);
console.log(`errors   : ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 4)) console.log(`  ${e.slice(0, 160)}`);
for (const m of missing.slice(0, 10)) console.log(`  - ${m}`);
