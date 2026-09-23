/**
 * A picture of the page, and a list of what is actually on it.
 *
 * The served HTML only shows what the server rendered; anything a section
 * builds after hydration is invisible to curl. This loads the page properly,
 * waits for it to settle, saves a full-page screenshot and reports the visible
 * headings and controls - which is the thing to compare against, rather than
 * byte counts.
 *
 *   node scripts/ops/shot.mjs [url] [out.png] [width]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://softwarevala.net/";
const out = process.argv[3] ?? "homepage.png";
const width = Number(process.argv[4] ?? 1440);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(6000);

// Walk to the bottom so lazy sections render, then back to the top to shoot.
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);

const seen = await page.evaluate(() => {
  const text = (el) => (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  return {
    title: document.title,
    headings: Array.from(document.querySelectorAll("h1,h2,h3"))
      .map(text).filter(Boolean).slice(0, 40),
    buttons: Array.from(new Set(
      Array.from(document.querySelectorAll("button,a[href]"))
        .map(text).filter((t) => t && t.length < 32),
    )).slice(0, 40),
    counts: {
      sections: document.querySelectorAll("section").length,
      images: document.querySelectorAll("img").length,
      cards: document.querySelectorAll("[class*='card'],[class*='Card']").length,
      rails: document.querySelectorAll("[data-product-row],[class*='rail'],[class*='carousel']").length,
      productLinks: document.querySelectorAll("a[href*='/product/']").length,
      domNodes: document.getElementsByTagName("*").length,
      docHeight: document.documentElement.scrollHeight,
    },
  };
});

await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(`url    : ${url}`);
console.log(`width  : ${width}px`);
console.log(`title  : ${seen.title}`);
console.log(`shot   : ${out}`);
console.log(`\ncounts:`);
for (const [k, v] of Object.entries(seen.counts)) console.log(`  ${k.padEnd(14)} ${v}`);
console.log(`\nheadings on the page (${seen.headings.length}):`);
for (const h of seen.headings) console.log(`  ${h}`);
console.log(`\nclickable labels (${seen.buttons.length}):`);
for (const b of seen.buttons) console.log(`  ${b}`);
console.log(`\nconsole errors: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 6)) console.log(`  ${e.slice(0, 140)}`);
