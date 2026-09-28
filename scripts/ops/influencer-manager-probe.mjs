/**
 * What is broken in Influencer Manager, from the outside.
 *
 * Opens every section an operator can reach, and for each one records what the
 * screen rendered, what it told the operator, and every request that failed.
 * A section that shows an empty state while its table holds rows, or that makes
 * a request that 4xx-es, is what this is looking for.
 *
 *   node scripts/ops/influencer-manager-probe.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const line of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = (ops.SV_SITE ?? "https://softwarevala.net").replace(/\/$/, "");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

const failed = [];
const consoleErrors = [];
page.on("response", async (r) => {
  if (r.status() < 400) return;
  let body = "";
  try { body = (await r.text()).slice(0, 170); } catch {}
  failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(SITE, "").slice(0, 110)}  ${body}`);
});
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 130)));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 130));
});

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2500);
console.log(`signed in as ${ops.SV_LOGIN_CONTROL_PANEL}\n`);

failed.length = 0;
consoleErrors.length = 0;

await page.goto(`${SITE}/influencer-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(12_000);

const shell = await page.evaluate(() => {
  const text = document.body.innerText || "";
  return {
    restricted: /access restricted|checking workspace access/i.test(text),
    heading: (document.querySelector("h1, h2")?.textContent ?? "").trim().slice(0, 60),
    nodes: document.getElementsByTagName("*").length,
    sections: [...document.querySelectorAll("button, a, [role=tab]")]
      .map((e) => (e.textContent || "").trim())
      .filter((t) => t && t.length > 1 && t.length < 34),
  };
});

console.log(`restricted : ${shell.restricted}`);
console.log(`heading    : ${shell.heading}`);
console.log(`nodes      : ${shell.nodes}`);
console.log(`failed requests on load: ${failed.length}`);
failed.slice(0, 6).forEach((f) => console.log(`   ${f}`));
console.log(`console errors on load : ${consoleErrors.length}`);
consoleErrors.slice(0, 4).forEach((e) => console.log(`   ${e}`));

// The sections, as the sidebar offers them.
const seen = new Set();
const labels = shell.sections.filter((s) => {
  const k = s.toLowerCase();
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
console.log(`\nsections offered (${labels.length}): ${labels.slice(0, 26).join(" | ")}`);

console.log("\n──────── walking each section");
for (const label of labels.slice(0, 22)) {
  if (/sign out|logout|back|refresh|english/i.test(label)) continue;
  failed.length = 0;
  consoleErrors.length = 0;
  const target = page.locator("button, a, [role=tab]").filter({ hasText: label }).first();
  if (!(await target.count())) continue;
  try {
    await target.click({ timeout: 6000 });
  } catch {
    console.log(`  ${label.padEnd(26)} could not be clicked`);
    continue;
  }
  await page.waitForTimeout(6500);
  const state = await page.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      nodes: document.getElementsByTagName("*").length,
      rows: document.querySelectorAll("tbody tr").length,
      empty: /no (data|records|results|influencers|applications|payouts|campaigns)|nothing (yet|here)|not configured|coming soon/i.test(text),
      problem: (text.match(/(could not|failed to|unauthori[sz]ed|permission|error)[^\n]{0,70}/i) ?? [])[0] ?? null,
    };
  });
  console.log(
    `  ${label.padEnd(26)} nodes=${String(state.nodes).padEnd(5)} rows=${String(state.rows).padEnd(4)} ` +
      `empty=${String(state.empty).padEnd(6)} failed=${String(failed.length).padEnd(3)} errs=${consoleErrors.length}` +
      (state.problem ? `  «${state.problem}»` : ""),
  );
  if (failed.length) failed.slice(0, 2).forEach((f) => console.log(`       ${f}`));
}

await browser.close();
