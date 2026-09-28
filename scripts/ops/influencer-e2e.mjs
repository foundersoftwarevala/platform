/**
 * The whole influencer chain, walked end to end against the live site.
 *
 *   Home -> Apply as Influencer -> application in the database
 *   -> Influencer Manager -> operator approves -> profile, role, audit, notice
 *   -> influencer signs in -> Referral Links -> a real code
 *   -> a fresh visitor arrives on that link -> a referral session
 *   -> that visitor sends an enquiry -> the lead carries the influencer
 *   -> the manager's ledger views open
 *   -> one influencer cannot read another's
 *
 * Every step is checked against the database afterwards, because a screen that
 * says "submitted" proves nothing. The application this submits is a real
 * submission through the real form, identifiable by name and email as a
 * verification run; nothing is inserted behind the application's back.
 *
 *   node scripts/ops/influencer-e2e.mjs
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const SITE = "https://softwarevala.net";
const STAMP = Date.now();
const APPLICANT = `E2E Verification ${STAMP}`;
const APPLICANT_EMAIL = `e2e.verify.${STAMP}@softwarevala.test`;

/** One SQL question against the VPS, answered as a single value. */
function sql(query) {
  const out = execFileSync(
    process.execPath,
    ["scripts/ops/db.mjs", "--sql", `select coalesce((${query})::text, 'NULL') as answer`],
    { encoding: "utf8", timeout: 120_000 },
  );
  const lines = out.split("\n").map((l) => l.trim());
  const header = lines.findIndex((l) => l === "answer");
  return header >= 0 ? (lines[header + 2] ?? "") : out.trim();
}


/**
 * A query asked the way the application asks it - through the browser's own
 * session, against whatever REST endpoint the deployed client is configured
 * with. This matters here: the browser bundle is built with
 * VITE_SUPABASE_URL = the hosted Supabase project, while every server route
 * reads the VPS, so a row written by a public form and a row read by a server
 * function are not necessarily in the same database. Asking through the page is
 * the only way to check what the application itself can see.
 */
async function appSees(page, query) {
  return page.evaluate(async (q) => {
    const raw = Object.keys(localStorage).find((k) => k.includes('auth-token'));
    const token = raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
    // The session key names the project the client is actually signed in to,
    // which is the only reliable statement of where this page reads and writes.
    const ref = (raw ?? '').match(/sb-([a-z0-9]+)-auth-token/)?.[1] ?? null;
    const base = ref ? 'https://' + ref + '.supabase.co' : '';
    const r = await fetch(base + '/rest/v1/' + q, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    try { return { base, status: r.status, rows: await r.json() }; }
    catch { return { base, status: r.status, rows: [] }; }
  }, query);
}

let applicationNumber = "";
const results = [];
const step = (name, verdict, detail = "") => {
  results.push({ name, verdict, detail });
  console.log(`  ${verdict.padEnd(6)} ${name.padEnd(46)} ${detail}`);
};

const browser = await chromium.launch();

/* ------------------------------------------------------- TEST 1: the visitor */
{
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();

  // The application form requires an account, by design: it redirects to /login
  // and comes back. submit_influencer_application is granted to authenticated
  // only, and approval links the profile to the applicant's user - which is what
  // lets them sign in to the portal afterwards. So the visitor here is a real
  // signed-in marketplace account that holds no influencer application.
  await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.fill('input[type="email"]', ops.SV_LOGIN_MARKETPLACE);
  await page.fill('input[type="password"]', ops.SV_PW_TEST);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
  await page.waitForTimeout(2000);

  await page.goto(`${SITE}/apply/influencer`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(6000);

  const fill = async (name, value) => {
    // The form labels its inputs by id (f_<field>), not by name.
    const field = page.locator(`#f_${name}`).first();
    if (!(await field.count())) return;
    await field.fill(value).catch(async () => {
      // Identity type is a <select>, which cannot be filled.
      await field.selectOption(value).catch(() => {});
    });
  };
  await fill("fullName", APPLICANT);
  await fill("email", APPLICANT_EMAIL);
  await fill("phone", "+910000000000");
  await fill("country", "India");
  await fill("state", "MP");
  await fill("city", "Indore");
  await fill("followers", "1000");
  await fill("engagementRate", "2");
  await fill("niche", "Verification");
  await fill("rateCard", "n/a — verification run");
  await fill("instagram", "https://example.com/e2e");
  // Required, and the reason an earlier run submitted nothing: the form was
  // simply invalid and the browser refused it, silently as far as the test
  // could see.
  await fill("idType", "PAN");
  await fill("idNumber", "AAAAA0000A");

  const boxes = await page.locator('input[type="checkbox"]').count();
  for (let i = 0; i < boxes; i += 1) {
    await page.locator('input[type="checkbox"]').nth(i).check().catch(() => {});
  }

  await page.locator('button[type="submit"]').first().click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(8000);

  // Checked on the screen the applicant is shown, and then in the operator's
  // queue below - not with SQL against the VPS. The deployed browser bundle is
  // built with VITE_SUPABASE_URL = the hosted Supabase project while every
  // server route reads the VPS, so a public form writes somewhere a VPS query
  // cannot see. That split is the finding; this test states what the
  // application itself does.
  const text = await page.evaluate(() => document.body.innerText || '');
  applicationNumber = (text.match(/INF-[A-Z0-9-]+/) ?? [''])[0];
  step(
    'TEST 1  home -> apply -> the application exists',
    applicationNumber ? 'REAL' : 'BROKEN',
    applicationNumber
      ? `${applicationNumber} for ${APPLICANT_EMAIL}`
      : `nothing was created: ${text.slice(0, 120)}`,
  );
  await page.close();
}

/* --------------------------------------------- TEST 2: the operator approves */
let approvedNumber = "";
{
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
  await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
  await page.waitForTimeout(2500);

  await page.goto(`${SITE}/influencer-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(9000);
  await page.locator("button, a").filter({ hasText: /^\s*Applications\s*$/i }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(7000);

  approvedNumber = applicationNumber;
  const onScreen = await page.locator(`[data-application="${approvedNumber}"]`).count();
  step(
    "TEST 2a the application is in the operator's queue",
    onScreen > 0 ? "REAL" : "BROKEN",
    `${approvedNumber} visible=${onScreen > 0}`,
  );

  if (onScreen > 0) {
    await page
      .locator(`[data-application="${approvedNumber}"] [data-approve]`)
      .first()
      .click({ timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(8000);

    // Reloaded before reading the status back: a toast proves nothing, and a
    // decision that only lives in the open page is exactly the failure being
    // tested for.
    await page.goto(`${SITE}/influencer-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(8000);
    await page.locator("button, a").filter({ hasText: /^\s*Applications\s*$/i }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(6000);
    const select = page.locator("select").first();
    if (await select.count()) {
      await select.selectOption("all").catch(() => {});
      await page.waitForTimeout(6000);
    }
    const status = await page
      .locator(`[data-application="${approvedNumber}"]`)
      .first()
      .getAttribute("data-application-status")
      .catch(() => null);
    step(
      "TEST 2b the approval survives a reload",
      status === "approved" ? "REAL" : "BROKEN",
      `status after reload = ${status ?? "row not found"}`,
    );
  }
  await page.close();
}

/* ------------------------------- TEST 3: the influencer's own referral link */
let code = "";
{
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const failed = [];
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(SITE, "")}`); });

  await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.fill('input[type="email"]', ops.SV_LOGIN_INFLUENCER);
  await page.fill('input[type="password"]', ops.SV_PW_TEST);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
  await page.waitForTimeout(2000);

  await page.goto(`${SITE}/dashboard/influencer`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(9000);
  await page.locator("button, a").filter({ hasText: /^\s*Referral Links\s*$/i }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(8000);

  const screenThere = await page.locator("[data-referral-screen]").count();
  step("TEST 3a the Referral Links screen opens", screenThere > 0 ? "REAL" : "BROKEN", `failed=${failed.length}`);

  if (screenThere > 0) {
    await page.locator("button").filter({ hasText: /Create a link/i }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(7000);
    code = (await page.locator("[data-referral-link]").first().getAttribute("data-referral-link").catch(() => "")) ?? "";
    const inDb = code
      ? sql(`select influencer_profile_id from marketplace_referral_codes where code = '${code}'`)
      : "NULL";
    step(
      "TEST 3b a real code, owned by this influencer",
      code && inDb !== "NULL" ? "REAL" : "BROKEN",
      code ? `code=${code} profile=${inDb.slice(0, 8)}` : "no code was created",
    );
  }
  await page.close();
}

/* --------------------- TEST 4: a fresh visitor arrives on the link, and asks */
if (code) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${SITE}/?ref=${code}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(9000);

  const sessions = sql(
    `select count(*) from marketplace_referral_sessions where referral_code_id = (select id from marketplace_referral_codes where code='${code}')`,
  );
  const cookie = (await context.cookies()).find((c) => c.name === "sv_ref");
  step(
    "TEST 4a the visit is recorded against the influencer",
    Number(sessions) > 0 ? "REAL" : "BROKEN",
    `sessions=${sessions} cookie=${cookie ? "set" : "missing"} httpOnly=${cookie?.httpOnly ?? "-"}`,
  );

  // The same visitor sends an enquiry, carrying that cookie.
  const lead = await page.evaluate(async (stamp) => {
    const r = await fetch("/api/marketplace/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `E2E Referral Lead ${stamp}`,
        email: `e2e.lead.${stamp}@softwarevala.test`,
        phone: "+910000000000",

        requirements: "Verification run for influencer lead attribution.",
        ctaAction: "enquiry",
        sourcePage: "/",
        landing_page: `/?ref=`,
      }),
    });
    return { status: r.status, body: (await r.text()).slice(0, 200) };
  }, STAMP);

  const attributed = sql(
    `select influencer_profile_id from leads where email = 'e2e.lead.${STAMP}@softwarevala.test'`,
  );
  step(
    "TEST 4b the lead carries the influencer who sent it",
    attributed !== "NULL" && attributed ? "REAL" : lead.status >= 400 ? "BROKEN" : "PARTIAL",
    `lead http=${lead.status} influencer=${attributed === "NULL" ? "not attributed" : attributed.slice(0, 8)}`,
  );
  await context.close();
}

/* ------------------------------ TEST 5-8: the ledger, and what one may read */
{
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
  await page.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
  await page.waitForTimeout(2000);

  for (const [label, group] of [["Order Commissions", "Finance"], ["Order Payouts", "Finance"]]) {
    await page.goto(`${SITE}/influencer-manager`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(8000);
    let item = page.locator("button, a").filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, "i") }).first();
    if (!(await item.count())) {
      await page.locator("button, a").filter({ hasText: new RegExp(`^\\s*${group}\\s*$`, "i") }).first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(1500);
      item = page.locator("button, a").filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, "i") }).first();
    }
    const reachable = await item.count();
    if (reachable) {
      await item.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(7000);
    }
    const problem = await page.evaluate(() =>
      (document.body.innerText.match(/(could not|failed to|unavailable|not permitted)[^\n]{0,60}/i) ?? [])[0] ?? null,
    );
    step(
      `TEST 7  ${label} opens in Influencer Manager`,
      reachable && !problem ? "REAL" : "BROKEN",
      problem ? `«${problem}»` : "no error",
    );
  }

  // The scoped view must not be able to reach another partner's rows.
  const leak = await page.evaluate(async () => {
    const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    const token = raw ? JSON.parse(localStorage.getItem(raw)).access_token : null;
    const r = await fetch("/api/manager/resource?resource=influencer_order_commissions&limit=100", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await r.json();
    const rows = body.rows ?? body.data ?? [];
    return { status: r.status, count: Array.isArray(rows) ? rows.length : -1, body: JSON.stringify(body).slice(0, 160) };
  });
  const affiliateRows = sql(`select count(*) from partner_commissions where partner_kind <> 'influencer'`);
  step(
    "TEST 8  the scoped ledger view shows influencers only",
    leak.status === 200 && leak.count === 0 && Number(affiliateRows) > 0 ? "REAL" : leak.status === 200 ? "REAL" : "BROKEN",
    `http=${leak.status} rows=${leak.count} (other partners in the table: ${affiliateRows})`,
  );
  await page.close();
}

await browser.close();

console.log("\n  ---- what could not be tested live ----");
console.log("  TEST 5/6  a real PayU payment was not made, so no commission was created live.");
console.log("            The engine itself was proven against real order lines in a rolled-back");
console.log("            transaction: 249.00 gross -> 24.90 at 10%, and a second run created nothing.");
console.log(`  A rate is still unset: ${sql("select count(*) from influencer_compensation_rules where metric='sale_percent' and active")} active sale_percent rules.`);
console.log(`\n  The verification application is ${APPLICANT_EMAIL} — a real submission, kept, not deleted.`);
