/**
 * What "Show more" costs, click after click.
 *
 * A single click proves nothing here: the page survived one and crashed the
 * browser tab during an earlier button sweep. This clicks it repeatedly and
 * records what grows each time — DOM nodes, rendered characters, JS heap and
 * how long the click took to settle — so the shape of the growth is visible
 * rather than the outcome of one press.
 *
 * It reads. It clicks a button the page already offers, which is what a
 * visitor does, and it writes nothing.
 *
 *   node scripts/ops/probe-showmore.mjs [path] [clicks]
 */
import { chromium } from "@playwright/test";

const SITE = (process.env.SV_SITE || "https://softwarevala.net").replace(/\/+$/, "");
const PATHNAME = process.argv[2] || "/marketplace";
const CLICKS = Number(process.argv[3] || 12);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

let crashed = false;
page.on("crash", () => {
  crashed = true;
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

await page.goto(`${SITE}${PATHNAME}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForTimeout(6000);

async function snapshot() {
  return page.evaluate(() => ({
    nodes: document.getElementsByTagName("*").length,
    chars: document.body.innerText.length,
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0,
    images: document.images.length,
  }));
}

const start = await snapshot();
console.log(`${SITE}${PATHNAME}`);
console.log(
  `  start          ${String(start.nodes).padStart(7)} nodes  ${String(start.chars).padStart(8)} chars  ${String(start.heap).padStart(5)} MB heap  ${start.images} images\n`,
);

let previous = start;
for (let i = 1; i <= CLICKS; i += 1) {
  const button = page.locator("button", { hasText: /show more/i }).first();
  if (!(await button.count())) {
    console.log(`  click ${i}: no "Show more" left — the whole catalogue is shown`);
    break;
  }

  const began = Date.now();
  try {
    await button.click({ timeout: 15_000 });
  } catch (error) {
    console.log(`  click ${i}: could not click — ${String(error).slice(0, 80)}`);
    break;
  }
  await page.waitForTimeout(1200);
  const took = Date.now() - began;

  if (crashed) {
    console.log(`  click ${i}: THE TAB CRASHED`);
    break;
  }

  let now;
  try {
    now = await snapshot();
  } catch {
    console.log(`  click ${i}: the page stopped responding`);
    break;
  }

  console.log(
    `  click ${String(i).padStart(2)}  ` +
      `${String(now.nodes).padStart(7)} nodes (+${String(now.nodes - previous.nodes).padStart(5)})  ` +
      `${String(now.chars).padStart(8)} chars (+${String(now.chars - previous.chars).padStart(6)})  ` +
      `${String(now.heap).padStart(5)} MB  ` +
      `${String(took).padStart(5)} ms`,
  );
  previous = now;
}

console.log(
  `\n  total growth: ${previous.nodes - start.nodes} nodes, ${previous.chars - start.chars} chars, ` +
    `${previous.heap - start.heap} MB`,
);
console.log(`  crashed: ${crashed}`);
console.log(`  page errors: ${errors.length}`);
for (const e of errors.slice(0, 4)) console.log(`      ${e}`);

await browser.close();
process.exit(crashed ? 1 : 0);
