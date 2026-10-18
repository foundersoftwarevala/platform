/**
 * The exact elements behind each critical accessibility violation, per route.
 *
 * Runs the same axe-core build the Control Panel scan uses and prints, for
 * every violation of the given impact (critical by default), the rule, the
 * element's selector and its HTML - so each one can be fixed where it is
 * written rather than counted.
 *
 *   node scripts/ops/axe-critical-probe.mjs [base] [--as=ACCOUNT] [--impact=critical,serious] /route ...
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const AS = (process.argv.find((a) => a.startsWith("--as=")) ?? "--as=CONTROL_PANEL").slice(5);
const IMPACT = (process.argv.find((a) => a.startsWith("--impact=")) ?? "--impact=critical").slice(9).split(",");
const ROUTES = process.argv.slice(2).filter((a) => a.startsWith("/"));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3500);
await page.fill('input[type="email"]', ops[`SV_LOGIN_${AS}`]);
await page.fill('input[type="password"]', ops[`SV_PW_${AS}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

// --press: like the Control Panel scan, press the page's buttons one after
// another (writes stopped at the network, dialogs dismissed) and check after
// each press, so a violation inside a form or panel a button opens is found
// and credited to that button.
const PRESS = process.argv.includes("--press");
if (PRESS) {
  await page.context().route("**/*", (route) => {
    const r = route.request();
    const read = ["GET", "HEAD", "OPTIONS"].includes(r.method()) || /\/auth\/v1\/(token|user)/.test(r.url());
    return read ? route.continue() : route.abort();
  });
  page.on("dialog", (d) => d.dismiss().catch(() => undefined));
}

async function critical() {
  if (!(await page.evaluate(() => Boolean(window.axe)))) {
    await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js" });
  }
  return page.evaluate(async (impact) => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations
      .filter((v) => impact.includes(v.impact))
      .flatMap((v) => v.nodes.map((n) => ({ rule: v.id, impact: v.impact, target: n.target.join(" "), html: n.html.slice(0, 180) })));
  }, IMPACT);
}

let total = 0;
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(7000);
  const seen = new Map();
  const note = (list, via) => {
    for (const f of list) {
      const key = `${f.rule} ${f.html}`;
      if (!seen.has(key)) seen.set(key, { ...f, via });
    }
  };
  note(await critical(), "on load");
  if (PRESS) {
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll("main button, [role=main] button, section button, table button")]
        .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.disabled && !b.closest("nav,aside,header"); })
        .map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40))
        .filter(Boolean)
        .filter((l, i, all) => all.indexOf(l) === i)
        .slice(0, 20),
    );
    for (const label of labels) {
      const clicked = await page.getByRole("button", { name: label, exact: true }).first().click({ timeout: 2500 }).then(() => true).catch(() => false);
      if (!clicked) continue;
      await page.waitForTimeout(1200);
      note(await critical(), `after pressing "${label}"`);
    }
  }
  const found = [...seen.values()];
  total += found.length;
  console.log(`\n${route}  ${found.length}`);
  for (const f of found) console.log(`  [${f.rule}] (${f.via}) ${f.target}\n      ${f.html.replace(/\s+/g, " ")}`);
}
console.log(`\ntotal ${total}`);
await browser.close();
