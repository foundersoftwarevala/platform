/**
 * Where a click inside a product rail actually lands.
 *
 * The rails support click-and-drag on desktop, and a rail that takes pointer
 * capture on the way down becomes the target of the click that follows - so a
 * button inside a card can look pressed and do nothing. This clicks a card's
 * Tech Stack tab and reports which element the browser handed the click to.
 *
 *   node scripts/ops/probe-card-click.mjs "<card name>" [url]
 */
import { chromium } from "@playwright/test";

const name = process.argv[2] ?? "Pathology Lab Software";
const url = process.argv[3] ?? "https://softwarevala.net/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(4000);

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

await page.evaluate(() => {
  window.__clicks = [];
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target;
      window.__clicks.push({
        tag: el.tagName,
        cls: (el.className ?? "").toString().slice(0, 60),
        text: (el.textContent ?? "").trim().slice(0, 30),
        prevented: e.defaultPrevented,
      });
    },
    true,
  );
});

const card = page.locator(".sv-card").filter({ has: page.locator(`h3:text-is("${name}")`) }).first();
await card.scrollIntoViewIfNeeded();
const tab = card.getByRole("button", { name: "Tech Stack" });
await tab.click();
await page.waitForTimeout(800);

const result = await page.evaluate(() => ({
  clicks: window.__clicks,
  active: [...document.querySelectorAll(".sv-tab-on")].map((b) => b.textContent.trim()).slice(0, 4),
}));

await browser.close();
console.log(`card   : ${name}`);
console.log(`clicked: Tech Stack`);
console.log(`\nclick events seen (capture phase):`);
for (const c of result.clicks) console.log(`  <${c.tag}> "${c.text}" class="${c.cls}" prevented=${c.prevented}`);
console.log(`\ntabs showing as active anywhere on the page: ${JSON.stringify(result.active)}`);
