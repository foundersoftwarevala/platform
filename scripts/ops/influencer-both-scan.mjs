/**
 * Both influencer modules, section by section.
 *
 * They are two different things and the difference is the point:
 *
 *   /dashboard/influencer   the portal an influencer works in, scoped to that
 *                           one person
 *   /influencer-manager     the Manager an operator works in, scoped to the
 *                           whole programme, reached from Control Panel
 *
 * For every section this records what rendered, how many rows it put on screen,
 * whether it is telling the operator it has nothing, every request that failed,
 * and every console error - so a section that shows an empty state while its
 * table holds rows is visible, which is the failure that does not announce
 * itself.
 *
 *   node scripts/ops/influencer-both-scan.mjs
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
const errors = [];
page.on("response", async (r) => {
  if (r.status() < 400) return;
  let body = "";
  try { body = (await r.text()).slice(0, 150); } catch {}
  failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(SITE, "").slice(0, 95)} ${body}`);
});
page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });

await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);
await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
await page.waitForTimeout(2500);

const look = () =>
  page.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      restricted: /access restricted|checking workspace access/i.test(text),
      heading: (document.querySelector("h1, h2")?.textContent ?? "").trim().slice(0, 48),
      nodes: document.getElementsByTagName("*").length,
      rows: document.querySelectorAll("tbody tr").length,
      // A section that says it has nothing.
      empty: /no (data|records|results|influencers|applications|payouts|campaigns|profiles|assignments|invoices)\b|nothing (yet|here)|not configured|coming soon|no results/i.test(text),
      // A number on screen that is not zero, which is what "connected" looks like.
      hasFigure: /\b(?!0\b)\d[\d,]*(\.\d+)?\b/.test(text.replace(/20\d\d/g, "")),
      problem: (text.match(/(could not|failed to|unauthori[sz]ed|no permission|is not configured)[^\n]{0,60}/i) ?? [])[0] ?? null,
    };
  });

async function scan(title, url, sectionLabels) {
  console.log(`\n════════  ${title}   ${url}`);
  failed.length = 0;
  errors.length = 0;
  await page.goto(`${SITE}${url}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(12_000);
  const first = await look();
  console.log(
    `  landing            restricted=${first.restricted}  "${first.heading}"  nodes=${first.nodes}  ` +
      `rows=${first.rows}  empty=${first.empty}  figures=${first.hasFigure}  failed=${failed.length}  errs=${errors.length}`,
  );
  if (first.problem) console.log(`     says: «${first.problem}»`);
  failed.slice(0, 3).forEach((f) => console.log(`     ${f}`));
  errors.slice(0, 3).forEach((e) => console.log(`     ${e}`));

  const labels = sectionLabels ?? (await page.evaluate(() => {
    const seen = new Set();
    return [...document.querySelectorAll("button, a, [role=tab]")]
      .map((e) => (e.textContent || "").trim())
      .filter((t) => t && t.length > 2 && t.length < 30 && !/sign out|logout|refresh|english|back|expand|control panel/i.test(t))
      .filter((t) => (seen.has(t.toLowerCase()) ? false : (seen.add(t.toLowerCase()), true)));
  }));

  for (const label of labels.slice(0, 20)) {
    failed.length = 0;
    errors.length = 0;
    // Fresh load each time: clicking through changes the sidebar, and a stale
    // sidebar is how a section gets measured twice and another not at all.
    await page.goto(`${SITE}${url}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(8000);
    const control = page
      .locator("button, a, [role=tab]")
      .filter({ hasText: new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i") })
      .first();
    if (!(await control.count())) continue;
    try { await control.click({ timeout: 6000 }); } catch { continue; }
    await page.waitForTimeout(7000);
    const s = await look();
    const verdict = s.problem ? "SAYS-PROBLEM" : failed.length ? "REQUEST-FAILED" : s.empty && !s.hasFigure ? "EMPTY" : "ok";
    console.log(
      `  ${label.padEnd(24)} ${verdict.padEnd(15)} nodes=${String(s.nodes).padEnd(5)} rows=${String(s.rows).padEnd(4)} ` +
        `figures=${String(s.hasFigure).padEnd(6)} failed=${failed.length} errs=${errors.length}` +
        (s.problem ? `  «${s.problem}»` : ""),
    );
    failed.slice(0, 2).forEach((f) => console.log(`     ${f}`));
  }
}

await scan("INFLUENCER PORTAL (the influencer's own)", "/dashboard/influencer");
await scan("INFLUENCER MANAGER (operates all of them)", "/influencer-manager");

await browser.close();
