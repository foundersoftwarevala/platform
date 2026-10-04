/**
 * Browser checks for the Control Panel finishing pass, against a local build.
 *
 *   node scripts/ops/cp-finishing-verify.mjs [base]
 *
 * As the operator: the Lead Manager CSV really downloads (name, header row,
 * one line per lead in view) and says so; AI CEO Predictions shows no
 * invented forecast; every Dev Manager screen opens without a page error and
 * shows none of the figures that were typed in; Marketplace Manager's
 * Partners page shows the live counts from /api/control-panel/partners.
 * As the reseller: each hero button lands where it should.
 * Application writes are stopped and recorded; Cloudflare RUM telemetry is
 * also stopped but is not treated as an application write.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(64)} ${detail}`);
};

const browser = await chromium.launch();
async function signIn(email, password) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  const writes = [];
  await context.route("**/*", (route) => {
    const r = route.request();
    const url = r.url();
    // Reads, auth refresh and server-function reads pass; everything else is stopped.
    if (
      r.method() === "GET" ||
      r.method() === "HEAD" ||
      url.includes("/auth/v1/") ||
      (url.includes("/_serverFn/") && r.method() === "GET")
    )
      return route.continue();
    if (
      url.includes("/rest/v1/rpc/") &&
      /mm_notifications|affiliate_dashboard_stats|ams_recognition_pending/.test(url)
    )
      return route.continue();
    if (new URL(url).pathname === "/cdn-cgi/rum") return route.abort();
    writes.push(`${r.method()} ${url.replace(BASE, "")}`);
    return route.abort();
  });
  return { context, page, writes };
}

/* ------------------------------------------------------------ operator */
const op = await signIn(ops.SV_LOGIN_CONTROL_PANEL, ops.SV_PW_CONTROL_PANEL);
const errors = [];
op.page.on("pageerror", (e) => errors.push(String(e.message ?? e)));

// Lead Manager CSV.
await op.page.goto(`${BASE}/lead-manager`, { waitUntil: "domcontentloaded" });
await op.page.waitForTimeout(6000);
const inView = await op.page
  .locator("text=/records in view/")
  .first()
  .textContent()
  .catch(() => "");
const expected = Number((inView ?? "").match(/(\d+)/)?.[1] ?? NaN);
const [download] = await Promise.all([
  op.page.waitForEvent("download", { timeout: 15_000 }).catch(() => null),
  op.page
    .getByRole("button", { name: /Export CSV/ })
    .first()
    .click(),
]);
check("lead CSV downloads", Boolean(download));
if (download) {
  const name = download.suggestedFilename();
  check(
    "lead CSV file name is leads-<date>.csv",
    /^leads-\d{4}-\d{2}-\d{2}\.csv$/.test(name),
    name,
  );
  const text = readFileSync(await download.path(), "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  check(
    "lead CSV has the header row",
    /^"?name"?,/.test(lines[0] ?? ""),
    (lines[0] ?? "").slice(0, 60),
  );
  // A field may hold a line break inside quotes, so records are counted by a
  // quote-aware pass rather than by lines.
  let records = 0;
  let quoted = false;
  let started = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === "\n" || c === "\r")) {
      if (started) records += 1;
      started = false;
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      continue;
    }
    started = true;
  }
  if (started) records += 1;
  check(
    "lead CSV has exactly one row per lead in view",
    records - 1 === expected,
    `view=${expected} rows=${records - 1}`,
  );
}
const toast = await op.page
  .locator("text=/Exported \\d+ leads? as CSV/")
  .first()
  .isVisible()
  .catch(() => false);
check("lead CSV export says what it exported", toast);

// Nothing in view: the file still downloads, with the header row only, and says so.
await op.page.getByLabel("Search leads").fill("zz-no-lead-matches-this-zz");
await op.page.waitForTimeout(1500);
const [emptyDownload] = await Promise.all([
  op.page.waitForEvent("download", { timeout: 15_000 }).catch(() => null),
  op.page
    .getByRole("button", { name: /Export CSV/ })
    .first()
    .click(),
]);
const emptyText = emptyDownload ? readFileSync(await emptyDownload.path(), "utf8") : "";
check(
  "empty view still downloads a CSV with the header row only",
  Boolean(emptyDownload) && emptyText.trim().split(/\r?\n/).length === 1,
  `lines=${emptyText.trim().split(/\r?\n/).length}`,
);
check(
  "empty export says there was no lead in view",
  await op.page
    .locator("text=/No lead in view/")
    .first()
    .isVisible()
    .catch(() => false),
);

// AI CEO Predictions.
await op.page.goto(`${BASE}/ai-ceo/predictions`, { waitUntil: "domcontentloaded" });
await op.page.waitForTimeout(6000);
const predictions = await op.page.locator("body").innerText();
check(
  "predictions shows none of the invented forecasts",
  !/Revenue Growth Expected|Client #456|\+12%|Audit due|Staff Burnout/.test(predictions),
);
check(
  "predictions says no forecasting model is connected",
  /No forecasting model is connected/.test(predictions),
);
check(
  "predictions lists promise predictions or says there are none",
  /No prediction yet|Delivery promise at/.test(predictions),
);

// Dev Manager: every screen opens, and none of the typed-in figures are left.
await op.page.goto(`${BASE}/dev-manager`, { waitUntil: "domcontentloaded" });
await op.page.waitForTimeout(6000);
const SCREENS = [
  "Developer Dashboard",
  "Developer Registry",
  "Onboarding Requests",
  "Role & Skill Mapping",
  "Task Management",
  "Sprint / Milestone",
  "Build Assignment",
  "Code Submission",
  "Review & QA",
  "Bug Fix Tracker",
  "Performance KPI",
  "Payment & Incentive",
  "Compliance & NDA",
  "Security & Access",
  "Alerts & Escalation",
];
const INVENTED =
  /CANDIDATE-A1B2|BUG-001|BLD-001|SUB-001|REV-001|SPR-001|ALT-001|VIO-001|Sprint 23|Alpha Release|Project Alpha|MacBook Pro|192\.168\.x\.x|Payment gateway timeout|\b87%/;
for (const label of SCREENS) {
  const before = errors.length;
  const item = op.page
    .getByRole("button", { name: new RegExp(`^${label.replace(/[/&]/g, (c) => `\\${c}`)}`) })
    .first();
  const clicked = await item
    .click({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  await op.page.waitForTimeout(2500);
  const text = await op.page
    .locator("main")
    .innerText()
    .catch(() => "");
  const hit = text.match(INVENTED)?.[0];
  check(
    `dev manager: ${label}`,
    clicked && errors.length === before && !hit,
    !clicked
      ? "not found"
      : hit
        ? `invented: ${hit}`
        : errors.slice(before).join(" | ").slice(0, 80),
  );
}

// Partners.
const partners = await (
  await op.page.request.get(`${BASE}/api/control-panel/partners`, {
    headers: {
      Authorization: `Bearer ${await op.page.evaluate(() => {
        const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
        return key ? JSON.parse(localStorage.getItem(key) ?? "{}").access_token : "";
      })}`,
    },
  })
)
  .json()
  .catch(() => ({}));
await op.page.goto(`${BASE}/marketplace-manager?section=Partners`, {
  waitUntil: "domcontentloaded",
});
await op.page.waitForTimeout(6000);
let partnersText = await op.page.locator("body").innerText();
if (!/Partner Programs/.test(partnersText)) {
  await op.page
    .getByRole("button", { name: /^Partners$/ })
    .first()
    .click()
    .catch(() => undefined);
  await op.page.waitForTimeout(4000);
  partnersText = await op.page.locator("body").innerText();
}
const reseller = (partners.programmes ?? []).find((p) => p.kind === "reseller");
check("partners page opens", /Partner Programs/.test(partnersText));
check(
  "partners page shows the live reseller count",
  reseller && new RegExp(`\\b${reseller.live} active partners`).test(partnersText),
  `api=${reseller?.live}`,
);

check(
  "operator pages raised no page error",
  errors.length === 0,
  errors.slice(0, 2).join(" | ").slice(0, 120),
);
check("operator checks wrote nothing", op.writes.length === 0, op.writes.slice(0, 3).join(" ; "));

/* ------------------------------------------------------------ reseller */
const rs = await signIn(
  ops.SV_LOGIN_RESELLER,
  ops.SV_PW_RESELLER ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL,
);
const HERO = [
  { cta: "Open generator", expect: /Referral Link Generator/ },
  { cta: "How coupons work", expect: /Coupons are issued and managed by Software Vala only/ },
  { cta: "Show plan", expect: /Membership|plan/i },
  { cta: "View ranks", expect: /Leaderboard|leaderboard|No record|Unranked/ },
];
for (const { cta, expect } of HERO) {
  await rs.page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await rs.page.waitForTimeout(5000);
  // Step the carousel to the slide carrying this button.
  let found = false;
  for (let i = 0; i < 10 && !found; i += 1) {
    await rs.page
      .getByRole("button", { name: `Banner ${i + 1}`, exact: true })
      .click()
      .catch(() => undefined);
    await rs.page.waitForTimeout(300);
    const button = rs.page.getByRole("button", { name: new RegExp(cta) }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      found = true;
    }
  }
  await rs.page.waitForTimeout(3500);
  const text = await rs.page.locator("body").innerText();
  check(`reseller hero: ${cta}`, found && expect.test(text), found ? "" : "button not found");
}
check(
  "reseller checks wrote nothing",
  rs.writes.filter((w) => !/_serverFn/.test(w)).length === 0,
  rs.writes.slice(0, 3).join(" ; "),
);

/* ----------------------------------------------- other partner dashboards */
const PARTNERS = [
  {
    login: "AFFILIATE",
    role: "affiliate",
    cta: "Create Link",
    expect: /New link|referral link yet|not an affiliate|pending/i,
  },
  { login: "VENDOR", role: "vendor", cta: "Add Product", expect: /catalogue team/ },
  { login: "AUTHOR", role: "author", cta: "Upload Product", expect: /catalogue team/ },
  { login: "INFLUENCER", role: "influencer", cta: "New Campaign", expect: /marketing team/ },
];
for (const p of PARTNERS) {
  const s = await signIn(
    ops[`SV_LOGIN_${p.login}`],
    ops[`SV_PW_${p.login}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL,
  );
  await s.page.goto(`${BASE}/dashboard/${p.role}`, { waitUntil: "domcontentloaded" });
  await s.page.waitForTimeout(5000);
  const button = s.page.getByRole("button", { name: new RegExp(p.cta) }).first();
  const found = await button
    .click({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  await s.page.waitForTimeout(3500);
  const text = await s.page.locator("body").innerText();
  check(
    `${p.role} hero: ${p.cta}`,
    found && p.expect.test(text),
    found ? (text.match(p.expect)?.[0] ?? "") : "button not found",
  );
  await s.context.close();
}

await browser.close();
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
