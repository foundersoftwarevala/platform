/**
 * What a named SEO Manager screen actually puts in front of an operator.
 *
 * The probe beside this one counts figures and says a screen "showed real
 * figures", which is a claim about a screen, not evidence of it. This prints
 * the text: every tile with its label and its value, the first rows of every
 * table, and a screenshot. If a tile reads "—" or "0" this says so, because
 * a screen that renders and shows nothing is the exact failure being looked
 * for and a count of figures would hide it.
 *
 *   node scripts/ops/show-seo-screen.mjs gate
 *   node scripts/ops/show-seo-screen.mjs cards https://softwarevala.net
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const MODULE = process.argv[2] || "gate";
const SITE = (process.argv.find((a) => a.startsWith("http")) || "https://softwarevala.net").replace(
  /\/+$/,
  "",
);

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at < 0 || line.trim().startsWith("#")) continue;
    out[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}
const ops = readEnv(".env.ops");
if (!ops.SV_LOGIN_CONTROL_PANEL || !ops.SV_PW_CONTROL_PANEL) {
  console.error("SV_LOGIN_CONTROL_PANEL and SV_PW_CONTROL_PANEL are needed in .env.ops");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
const page = await context.newPage();

await page.goto(`${SITE}/login`, { waitUntil: "networkidle", timeout: 120_000 });
await page.locator('input[type="email"]').fill(ops.SV_LOGIN_CONTROL_PANEL);
await page.locator('input[type="password"]').fill(ops.SV_PW_CONTROL_PANEL);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(9000);

await page.goto(`${SITE}/seo-manager?module=${MODULE}`, {
  waitUntil: "domcontentloaded",
  timeout: 120_000,
});
// The tiles each make their own counting request; give them time to answer.
await page.waitForTimeout(9000);

const seen = await page.evaluate(() => {
  const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

  // A tile is a small block whose text is a label and a value. Rather than
  // guess at class names, take every leaf-ish block and keep the short ones.
  const tiles = [...document.querySelectorAll("div")]
    .filter((el) => el.children.length <= 4 && el.querySelectorAll("div").length <= 3)
    .map((el) => clean(el.innerText))
    .filter((t) => t && t.length > 2 && t.length < 90 && /\d|—|…/.test(t));

  const tables = [...document.querySelectorAll("table")].map((table) => ({
    head: [...table.querySelectorAll("thead th")].map((th) => clean(th.innerText)),
    rows: [...table.querySelectorAll("tbody tr")]
      .slice(0, 6)
      .map((tr) => [...tr.querySelectorAll("td")].map((td) => clean(td.innerText))),
    count: table.querySelectorAll("tbody tr").length,
  }));

  return { tiles: [...new Set(tiles)], tables, heading: clean(document.title) };
});

mkdirSync("shots", { recursive: true });
const shot = `shots/seo-${MODULE}.png`;
await page.screenshot({ path: shot, fullPage: true });
await browser.close();

console.log(`screen : /seo-manager?module=${MODULE}`);
console.log(`shot   : ${shot}`);
console.log("");
console.log("tiles on the page:");
for (const tile of seen.tiles.slice(0, 40)) console.log(`  ${tile}`);
console.log("");
for (const table of seen.tables) {
  console.log(`table (${table.count} rows): ${table.head.join(" | ")}`);
  for (const row of table.rows) console.log(`  ${row.join(" | ")}`);
  console.log("");
}
