/**
 * Every Influencer Manager section that has rows in the database, opened the way
 * an operator opens it, and counted on screen.
 *
 * The sidebar groups are collapsed until their header is clicked, so a first
 * version of this reported "no control" for Social Accounts, Invoices and
 * Commission Rules when the real situation was that their group had never been
 * opened. Each row below therefore carries the group it lives in, and the group
 * is opened first.
 *
 * Applications is not a wall - it is its own queue screen - so a zero there
 * means something different from a zero on a wall.
 *
 *   node scripts/ops/_verify-walls.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";

// label, the sidebar group it sits under, rows the table actually holds
const expect = [
  ["Influencers", "Influencer Manager", 10],
  ["Creator Profiles", "Influencer Manager", 10],
  // 7 applications exist; the queue opens on "open", which is the 2 pending ones.
  ["Applications", "Influencer Manager", 2],
  ["Verification", "Influencer Manager", 2],
  ["Assignments", "Influencer Manager", 2],
  ["Social Accounts", "Content", 2],
  ["Commissions", "Finance", 2],
  ["Commission Rules", "Finance", 1],
  ["Payouts", "Finance", 6],
  ["Withdrawals", "Finance", 6],
  ["Wallet", "Finance", 2],
  ["Invoices", "Finance", 1],
];

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await c.newPage();
const bad = [];
const errs = [];
p.on("response", async (r) => {
  if (r.status() < 400) return;
  let t = "";
  try { t = (await r.text()).slice(0, 110); } catch {}
  bad.push(`${r.status()} ${r.url().replace(SITE, "").slice(0, 70)} ${t}`);
});
p.on("pageerror", (e) => errs.push(String(e).slice(0, 110)));

await p.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4000);
await p.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
await p.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 });
await p.waitForTimeout(2500);

const exact = (s) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");

for (const [label, group, want] of expect) {
  bad.length = 0;
  errs.length = 0;
  await p.goto(`${SITE}/influencer-manager`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(8000);

  let item = p.locator("button, a, [role=tab]").filter({ hasText: exact(label) }).first();
  if (!(await item.count())) {
    // The group is collapsed. Open it, then look again.
    const head = p.locator("button, a, [role=button]").filter({ hasText: exact(group) }).first();
    if (await head.count()) {
      await head.click({ timeout: 6000 }).catch(() => {});
      await p.waitForTimeout(1500);
      item = p.locator("button, a, [role=tab]").filter({ hasText: exact(label) }).first();
    }
  }
  if (!(await item.count())) {
    console.log(`  ${label.padEnd(18)} no control even after opening "${group}"`);
    continue;
  }

  await item.click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(8000);

  const seen = await p.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      // Applications is a queue of <li data-application>, not a table, and
      // counting only <tbody tr> reported it empty while it was showing rows.
      rows:
        document.querySelectorAll("tbody tr").length ||
        document.querySelectorAll("[data-application]").length,
      problem:
        (text.match(/(could not|failed to|unauthori[sz]ed|no permission|unavailable|is not configured)[^\n]{0,70}/i) ?? [])[0] ??
        null,
    };
  });

  const verdict = seen.problem ? "SAYS-PROBLEM" : seen.rows >= want ? "CONNECTED" : seen.rows > 0 ? "PARTIAL" : "EMPTY";
  console.log(
    `  ${label.padEnd(18)} ${verdict.padEnd(13)} rows=${String(seen.rows).padEnd(4)} table has ${String(want).padEnd(3)}` +
      `${seen.problem ? ` «${seen.problem}»` : ""}${bad.length ? `  failed: ${bad[0]}` : ""}${errs.length ? `  err: ${errs[0]}` : ""}`,
  );
}
await b.close();
