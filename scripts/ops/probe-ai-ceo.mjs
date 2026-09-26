/**
 * What the AI CEO console actually shows, from the inside.
 *
 * Every one of these screens is gated to boss and admin, so a sweep that only
 * asks over HTTP gets 200 and the access shell, and learns nothing. This signs
 * in, opens each screen, and reports what the screen put on the page: whether
 * figures appeared, whether a table has rows, and what the browser complained
 * about.
 *
 * Two things it refuses to call a pass. A screen that renders with every
 * number at zero or an em dash is reported as empty, because that is what an
 * operator would see. And a screen whose route never resolved falls back to
 * the dashboard, which looks perfectly healthy — the executive banner renders
 * for the dashboard and nothing else, so its presence anywhere else means the
 * route did not resolve and the run fails.
 *
 * An empty register is not a failure here. Three of these tables genuinely
 * hold no rows, and the screen naming its own empty source is the correct
 * result; what would be a failure is that screen inventing rows to look busy.
 *
 *   node scripts/ops/probe-ai-ceo.mjs
 *   node scripts/ops/probe-ai-ceo.mjs https://softwarevala.net
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

/**
 * Each login carries its own password, falling back to the shared test one —
 * the convention the other ops scripts follow. Pairing an account with
 * another account's password is a sign-in failure that looks exactly like a
 * permission failure, which is worth not doing twice.
 *
 * The role can be named on the command line; the control-panel account is the
 * default because these screens are gated to boss and admin.
 */
const role = (process.argv.find((a) => /^--role=/.test(a)) ?? "--role=CONTROL_PANEL").slice(7);
const email = ops[`SV_LOGIN_${role}`];
const password = ops[`SV_PW_${role}`] ?? ops.SV_PW_TEST;
if (!email || !password) {
  console.error(`SV_LOGIN_${role} (and a password) are needed in .env.ops`);
  process.exit(1);
}
console.log(`role: ${role}`);

/** Every AI CEO screen, by the path that addresses it. */
const SCREENS = [
  ["/ai-ceo", "Dashboard"],
  ["/ai-ceo/live-monitor", "Live Monitor"],
  ["/ai-ceo/decision-engine", "Decision Engine"],
  ["/ai-ceo/approvals", "Approvals"],
  ["/ai-ceo/predictions", "Predictions"],
  ["/ai-ceo/risk", "Risk & Compliance"],
  ["/ai-ceo/agents", "Agents"],
  ["/ai-ceo/tasks", "Tasks"],
  ["/ai-ceo/automations", "Automations"],
  ["/ai-ceo/notifications", "Notifications"],
  ["/ai-ceo/insights", "AI Insights"],
  ["/ai-ceo/performance", "Performance"],
  ["/ai-ceo/learning", "Learning"],
  ["/ai-ceo/reports", "Reports"],
  ["/ai-ceo/usage", "API Usage & Spend"],
  ["/ai-ceo/security", "Security Signals"],
  ["/ai-ceo/settings", "Settings"],
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
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(9000);
console.log(`landed on ${page.url().replace(SITE, "") || "/"}`);

const rows = [];
for (const [path, name] of SCREENS) {
  const before = consoleErrors.length;
  let opened = false;
  let restricted = false;
  try {
    await page.goto(`${SITE}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(6000);
    restricted = await page.evaluate(() =>
      /access restricted|checking workspace access/i.test(document.body.innerText ?? ""),
    );
    opened = !restricted;
  } catch {
    opened = false;
  }

  const fellBack =
    path !== "/ai-ceo" &&
    opened &&
    (await page.evaluate(() =>
      /what needs my attention right now/i.test(document.body.innerText ?? ""),
    ));

  const seen = await page.evaluate(() => {
    const body = document.body.innerText ?? "";
    const figures = (body.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d{2,}\b/g) ?? []).filter(
      (n) => Number(n.replace(/,/g, "")) > 0,
    );
    return {
      rows: document.querySelectorAll("tbody tr").length,
      figures: figures.length,
      // An empty register that names its own source is the correct result,
      // and is reported as such rather than as a screen that failed.
      named: /read from|holds no rows|is not configured|no rows/i.test(body),
    };
  });

  rows.push({ name, opened, restricted, fellBack, ...seen, errors: consoleErrors.length - before });
}

await browser.close();

console.log("");
console.log("screen                 opened   rows  figures  names source  console errors");
for (const r of rows) {
  const state = r.restricted ? "GATED" : r.fellBack ? "DASHBOARD" : String(r.opened);
  console.log(
    `${r.name.padEnd(22)} ${state.padEnd(8)} ${String(r.rows).padEnd(5)} ` +
      `${String(r.figures).padEnd(8)} ${String(r.named).padEnd(12)} ${r.errors}`,
  );
}

const unopened = rows.filter((r) => !r.opened);
const fallen = rows.filter((r) => r.fellBack);
const noisy = rows.filter((r) => r.errors > 0);
// Nothing at all: no rows, no figures, and no sentence explaining why.
const mute = rows.filter((r) => r.opened && !r.fellBack && r.rows === 0 && r.figures === 0 && !r.named);

console.log("");
if (unopened.length) console.log(`could not open: ${unopened.map((r) => r.name).join(", ")}`);
if (fallen.length)
  console.log(`never reached - the dashboard answered: ${fallen.map((r) => r.name).join(", ")}`);
if (mute.length)
  console.log(`showed nothing and explained nothing: ${mute.map((r) => r.name).join(", ")}`);
if (noisy.length) {
  console.log(`console errors on: ${noisy.map((r) => r.name).join(", ")}`);
  const distinct = [...new Set(consoleErrors.map((e) => String(e).slice(0, 160)))];
  console.log("");
  console.log(`distinct console errors (${distinct.length}):`);
  for (const line of distinct.slice(0, 12)) console.log(`  ${line}`);
}

if (unopened.length || fallen.length || mute.length) {
  const bad = new Set([...unopened, ...fallen, ...mute]);
  console.log(`\nRESULT: ${rows.length - bad.size}/${rows.length} screens show their own content.`);
  process.exit(1);
}
console.log(`\nRESULT: all ${rows.length} screens opened and showed their own content.`);
