/**
 * What a card's Tech Stack tab actually says.
 *
 * An entry that describes a software category rather than one product must not
 * name a stack, so this opens a named card's second tab and prints what a
 * reader would see there.
 *
 *   node scripts/ops/probe-tech-tab.mjs "<card name>" [url]
 */
import { chromium } from "@playwright/test";

const name = process.argv[2] ?? "Hospital Management Software";
const url = process.argv[3] ?? "https://softwarevala.net/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(4000);

// Walk down a screen at a time until the card's row has mounted.
let y = 0;
for (let i = 0; i < 400; i++) {
  const at = await page.evaluate((top) => {
    window.scrollTo(0, top);
    return { height: document.documentElement.scrollHeight, view: window.innerHeight };
  }, y);
  await page.waitForTimeout(300);
  if (await page.locator(`h3:text-is("${name}")`).count()) break;
  const next = y + Math.round(at.view * 0.7);
  if (next >= at.height - at.view) break;
  y = next;
}

const card = page.locator(".sv-card").filter({ has: page.locator(`h3:text-is("${name}")`) }).first();
await card.scrollIntoViewIfNeeded();
const panel = card.locator(".sv-fade-swap");
await panel.waitFor();
const features = (await panel.innerText()).trim();
const techTab = card.getByRole("button", { name: "Tech Stack" });
await techTab.click();
await techTab.and(page.locator(".sv-tab-on")).waitFor();
await page.waitForTimeout(400);
const tech = (await panel.innerText()).trim();

await browser.close();
console.log(`card : ${name}`);
console.log(`\nFeatures tab:\n${features}`);
console.log(`\nTech Stack tab:\n${tech}`);
