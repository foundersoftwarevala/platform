/**
 * What a product card's tabs actually open onto.
 *
 * The card offers "Features" and "Tech Stack" together whenever either has
 * something in it. No product in the catalogue records a tech stack, so on
 * every card that has features the second tab opens onto nothing. The browser
 * test for this kept passing, which is worth more scepticism than a failure:
 * it clicked and then asserted that a chip was visible, and a click that does
 * not change the panel leaves the first tab's chips on screen.
 *
 * This reports the panel's contents before and after the click instead of
 * asserting anything, so the answer is readable rather than inferred.
 *
 *   node scripts/ops/probe-card-tabs.mjs [url]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://softwarevala.net/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(6000);

const cards = page.locator(".sv-card-shell");
const total = await cards.count();
const tabbed = cards.filter({ has: page.locator("button.sv-tab") });
const tabbedCount = await tabbed.count();
console.log(`probing ${url}\n`);
console.log(`cards on the page      : ${total}`);
console.log(`cards that draw tabs   : ${tabbedCount}`);

if (tabbedCount === 0) {
  await browser.close();
  console.log("\nno card draws tabs — nothing to open");
  process.exit(0);
}

let emptyPanels = 0;
const sample = Math.min(tabbedCount, 5);
for (let i = 0; i < sample; i++) {
  const card = tabbed.nth(i);
  await card.scrollIntoViewIfNeeded();
  const name = (await card.locator("h3").first().textContent())?.trim() ?? "?";
  const tabs = card.locator("button.sv-tab");
  const labels = await tabs.allTextContents();
  console.log(`\n${name}`);
  console.log(`  tabs offered: ${labels.map((l) => `"${l.trim()}"`).join(", ")}`);
  for (let t = 0; t < labels.length; t++) {
    await tabs.nth(t).click();
    await page.waitForTimeout(400);
    const chips = await card.locator(".sv-chip").allTextContents();
    const label = labels[t].trim();
    console.log(
      `  after clicking "${label}": ${chips.length} chip(s)` +
        (chips.length ? ` — ${chips.slice(0, 4).map((c) => c.trim()).join(", ")}` : "  <-- EMPTY PANEL"),
    );
    if (chips.length === 0) emptyPanels++;
  }
}

await browser.close();
console.log(`\n=== verdict ===`);
if (emptyPanels > 0) {
  console.log(`  ${emptyPanels} tab(s) across ${sample} sampled card(s) opened onto an empty panel.`);
  process.exit(1);
}
console.log(`  every tab on the ${sample} sampled card(s) opened onto at least one chip.`);
