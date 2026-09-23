/**
 * Repeat the two variants that matter, because one run is not a result.
 *
 * The sweep suggested that making the rails and the cards render normally -
 * `content-visibility: visible` on both - restores paging on WebKit. But a
 * third variant containing the same rule did not, which means at least one of
 * those single runs was noise. Each is run several times here and reported
 * individually, so the answer is a pattern rather than a coincidence.
 *
 *   node scripts/ops/probe-safari-repeat.mjs [webkit|chromium] [runs]
 */
import { chromium, webkit, devices } from "@playwright/test";

const engine = process.argv[2] === "chromium" ? "chromium" : "webkit";
const RUNS = Number(process.argv[3] ?? 3);
const url = "https://softwarevala.net/";
const launcher = engine === "chromium" ? chromium : webkit;

const CV_OFF =
  ".mpc-home .sv-row-scroll,.mpc-home .sv-card-shell{content-visibility:visible!important}";

const browser = await launcher.launch();

async function once(css) {
  const context = await browser.newContext(
    engine === "webkit" ? devices["iPad (gen 7)"] : { viewport: { width: 820, height: 1180 } },
  );
  const page = await context.newPage();
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/marketplace/catalog")) calls++;
  });
  if (css) {
    await page.addInitScript((c) => {
      const apply = () => {
        const s = document.createElement("style");
        s.textContent = c;
        (document.head ?? document.documentElement).appendChild(s);
      };
      if (document.head) apply();
      else document.addEventListener("DOMContentLoaded", apply);
    }, css);
  }
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  if (css) await page.addStyleTag({ content: css }).catch(() => {});
  await page.waitForTimeout(2000);
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      window.scrollTo(0, h);
    });
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => ({
    rails: document.querySelectorAll("[data-product-row]").length,
    cards: document.querySelectorAll(".sv-card-shell").length,
  }));
  await context.close();
  return { ...out, calls };
}

console.log(`engine: ${engine}   runs per variant: ${RUNS}\n`);
for (const [label, css] of [["as it ships", ""], ["content-visibility: visible on rails and cards", CV_OFF]]) {
  console.log(label);
  const rows = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await once(css);
    rows.push(r);
    console.log(`  run ${i + 1}: rails=${String(r.rails).padEnd(3)} cards=${String(r.cards).padEnd(4)} requests=${r.calls}`);
  }
  const paged = rows.filter((r) => r.calls > 0).length;
  console.log(`  -> paged in ${paged} of ${RUNS} runs\n`);
}

await browser.close();
