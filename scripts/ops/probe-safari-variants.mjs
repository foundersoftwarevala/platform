/**
 * Which CSS rule stops the catalogue paging on WebKit.
 *
 * Paint containment on the section was the first candidate and it is not the
 * cause: removing it changed nothing. The remaining candidates are the other
 * things this stylesheet does to the rails and the page around them, so each
 * is removed on its own and the page is scrolled to the bottom with the same
 * measure every time - rails reached, and requests made for more.
 *
 * Nothing here is a fix. It is the experiment that decides which fix to write.
 *
 *   node scripts/ops/probe-safari-variants.mjs [webkit|chromium]
 */
import { chromium, webkit, devices } from "@playwright/test";

const engine = process.argv[2] === "chromium" ? "chromium" : "webkit";
const url = process.argv[3] ?? "https://softwarevala.net/";
const launcher = engine === "chromium" ? chromium : webkit;

const VARIANTS = [
  ["as it ships", ""],
  ["no paint containment", ".mpc-home section,.mpc-home header{contain:layout style!important}"],
  ["no containment at all", ".mpc-home section,.mpc-home header{contain:none!important}"],
  ["rails not content-visibility", ".mpc-home .sv-row-scroll{content-visibility:visible!important}"],
  ["cards not content-visibility", ".mpc-home .sv-card-shell{content-visibility:visible!important}"],
  [
    "neither content-visibility",
    ".mpc-home .sv-row-scroll,.mpc-home .sv-card-shell{content-visibility:visible!important}",
  ],
  [
    "no containment and no content-visibility",
    ".mpc-home section,.mpc-home header{contain:none!important}" +
      ".mpc-home .sv-row-scroll,.mpc-home .sv-card-shell{content-visibility:visible!important}",
  ],
  ["html not smooth-scrolling", "html{scroll-behavior:auto!important}"],
];

const browser = await launcher.launch();
console.log(`engine: ${engine}\nurl   : ${url}\n`);
console.log("variant".padEnd(42) + "rails  cards  catalogue requests");
console.log("-".repeat(78));

for (const [label, css] of VARIANTS) {
  const context = await browser.newContext(
    engine === "webkit" ? devices["iPad (gen 7)"] : { viewport: { width: 820, height: 1180 } },
  );
  const page = await context.newPage();
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/marketplace/catalog")) calls++;
  });
  if (css) await page.addInitScript((c) => {
    const apply = () => {
      const s = document.createElement("style");
      s.textContent = c;
      (document.head ?? document.documentElement).appendChild(s);
    };
    if (document.head) apply();
    else document.addEventListener("DOMContentLoaded", apply);
  }, css);

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
  console.log(
    label.padEnd(42) + String(out.rails).padEnd(7) + String(out.cards).padEnd(7) + String(calls),
  );
}

await browser.close();
