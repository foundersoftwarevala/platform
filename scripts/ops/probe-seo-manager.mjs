/**
 * What the SEO Manager actually shows, from the inside.
 *
 * The console is behind a sign-in, so every sweep so far has reported it as
 * "Access restricted" and stopped there - which is how it went unnoticed that
 * the two largest SEO datasets on the platform, the indexing gate's 14,819
 * verdicts and the 7,280 card slots' keyword blueprints, were not read by a
 * single screen in it.
 *
 * This signs in, opens each SEO module by name, and reports what the screen
 * put on the page: whether real figures appeared, whether a table has rows,
 * and what the browser complained about. A screen that renders with every
 * number at zero or an em dash is reported as empty, because that is what an
 * operator would see.
 *
 *   node scripts/ops/probe-seo-manager.mjs
 *   node scripts/ops/probe-seo-manager.mjs https://softwarevala.net
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const SITE = (process.argv[2] || "https://softwarevala.net").replace(/\/+$/, "");

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

/**
 * The modules this run cares about, by the id the route accepts.
 *
 * ?module=<id> addresses a screen directly. Clicking a sidebar item only
 * reaches whichever groups happen to be expanded, so a screen could look
 * broken when all that was wrong was a collapsed group.
 */
const MODULES = [
  ["gate", "Indexing Gate"],
  ["cards", "Card SEO"],
  ["dashboard", "Dashboard"],
  ["health", "SEO Health"],
  ["keywords", "Keyword Center"],
  ["aikeyword", "AI Keyword"],
  ["canonical", "Canonical"],
  ["sitemap", "Sitemap"],
  ["reports", "SEO Reports"],
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

console.log(`site: ${SITE}`);
console.log("signing in…");
await page.goto(`${SITE}/login`, { waitUntil: "networkidle", timeout: 120_000 });
await page.locator('input[type="email"]').fill(ops.SV_LOGIN_CONTROL_PANEL);
await page.locator('input[type="password"]').fill(ops.SV_PW_CONTROL_PANEL);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(9000);
console.log(`landed on ${page.url().replace(SITE, "") || "/"}`);

await page.goto(`${SITE}/seo-manager`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(7000);

const restricted = await page.evaluate(() =>
  /access restricted|checking workspace access/i.test(document.body.innerText ?? ""),
);
if (restricted) {
  console.log("\nFAIL — the account cannot open the SEO Manager.");
  await browser.close();
  process.exit(1);
}

const rows = [];
for (const [id, name] of MODULES) {
  const before = consoleErrors.length;
  let opened = false;
  try {
    await page.goto(`${SITE}/seo-manager?module=${id}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(6500);
    opened = !(await page.evaluate(() =>
      /access restricted|unavailable/i.test(document.body.innerText ?? ""),
    ));
  } catch {
    opened = false;
  }

  const seen = await page.evaluate(() => {
    const body = document.body.innerText ?? "";
    // A figure worth reporting: a number of two digits or more, or any number
    // with a thousands separator. A lone 0 is not evidence of data.
    const figures = (body.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d{2,}\b/g) ?? []).filter(
      (n) => Number(n.replace(/,/g, "")) > 0,
    );
    return {
      rows: document.querySelectorAll("tbody tr").length,
      figures: figures.length,
      biggest: figures.reduce(
        (a, b) => (Number(b.replace(/,/g, "")) > Number(String(a).replace(/,/g, "")) ? b : a),
        "0",
      ),
      chars: body.length,
    };
  });

  rows.push({
    name,
    opened,
    ...seen,
    errors: consoleErrors.length - before,
  });
}

await browser.close();

console.log("");
console.log("module            opened  table rows  figures  largest    console errors");
for (const r of rows) {
  console.log(
    `${r.name.padEnd(17)} ${String(r.opened).padEnd(7)} ${String(r.rows).padEnd(11)} ` +
      `${String(r.figures).padEnd(8)} ${String(r.biggest).padEnd(10)} ${r.errors}`,
  );
}

const empty = rows.filter((r) => r.opened && r.rows === 0 && r.figures === 0);
const unopened = rows.filter((r) => !r.opened);
const noisy = rows.filter((r) => r.errors > 0);

console.log("");
if (unopened.length) console.log(`could not open: ${unopened.map((r) => r.name).join(", ")}`);
if (empty.length) console.log(`opened but showed nothing: ${empty.map((r) => r.name).join(", ")}`);
if (noisy.length) {
  console.log(`console errors on: ${noisy.map((r) => r.name).join(", ")}`);
  // The distinct messages, not one line per occurrence: the same failure on
  // nine screens is one fault, and printing it nine times hides that.
  const distinct = [...new Set(consoleErrors.map((e) => String(e).slice(0, 160)))];
  console.log("");
  console.log(`distinct console errors (${distinct.length}):`);
  for (const line of distinct.slice(0, 12)) console.log(`  ${line}`);
}

if (unopened.length || empty.length) {
  console.log(
    `\nRESULT: ${rows.length - unopened.length - empty.length}/${rows.length} modules show something.`,
  );
  process.exit(1);
}
console.log(`\nRESULT: all ${rows.length} modules opened and showed real figures.`);
