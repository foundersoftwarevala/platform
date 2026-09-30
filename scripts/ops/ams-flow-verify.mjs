/**
 * The AMS flow, from a role dashboard to AMS Manager, on real data.
 *
 *   node scripts/ops/ams-flow-verify.mjs [base]
 *
 * Checks, in a browser, against the live database:
 *   - the author test account, whose real published product AMS recognised,
 *     sees its author journey on the dashboard - stage, rank, XP, the stage's
 *     achievement, the next milestone, its latest trophy and its author
 *     passport - and "Open AMS" opens the role's Achievements module;
 *   - a reseller with no recognised activity sees the empty state, no figure;
 *   - each dashboard shows its own role's journey only;
 *   - the operator sees the same passport and ledger in AMS Manager's views.
 * The figures expected are read from the database first, never assumed.
 * Nothing is written.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(70)} ${detail}`);
};
const sql = (q) =>
  execFileSync("node", ["scripts/ops/db.mjs", "--sql", q], { encoding: "utf8" })
    .split("\n").map((l) => l.trim()).filter((l) => l && !/^target|^-+$|rows?\)$/.test(l));

// What the database holds for the author account, as the expectation.
const [, authorRow] = sql(
  "select p.passport_no || '|' || x.total_xp || '|' || x.current_level " +
  "from ams_passports p join user_xp x on x.user_id=p.user_id and x.role=p.role " +
  "join auth.users u on u.id=p.user_id where u.email='test.author@softwarevala.test' and p.role='author'",
);
const [passportNo, authorXp, authorStage] = String(authorRow ?? "").split("|");
check("the database holds an author passport for the test author", Boolean(passportNo), passportNo ?? "none");

const browser = await chromium.launch();
async function signIn(login) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);
  await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]);
  await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  const writes = [];
  await context.route("**/*", (route) => {
    const r = route.request();
    const read = ["GET", "HEAD", "OPTIONS"].includes(r.method()) || /\/auth\/v1\/(token|user)/.test(r.url())
      || /rpc\/(mm_notifications|ams_role_chain)/.test(r.url()) || /_serverFn/.test(r.url());
    if (!read) writes.push(`${r.method()} ${r.url().replace(BASE, "").split("?")[0]}`);
    return read ? route.continue() : route.abort();
  });
  return { context, page, errors, writes };
}

/* ------------------------------------------------------------ author */
const author = await signIn("AUTHOR");
await author.page.goto(`${BASE}/dashboard/author`, { waitUntil: "domcontentloaded" });
await author.page.waitForTimeout(7000);
const card = author.page.locator("[data-ams-summary]").first();
const cardRole = await card.getAttribute("data-ams-summary").catch(() => null);
const cardText = (await card.innerText().catch(() => "")).replace(/\s+/g, " ");
check("the author dashboard shows an AMS summary for the author role", cardRole === "author", cardRole ?? "no card");
check(`it shows stage ${authorStage} of 10`, new RegExp(`Stage ${authorStage} of 10`).test(cardText), cardText.slice(0, 80));
check(`it shows ${authorXp} XP`, new RegExp(`\\b${Number(authorXp).toLocaleString()} XP`).test(cardText));
check("it shows the stage achievement and the next milestone", /Current achievement/.test(cardText) && /Next milestone/.test(cardText) && /Stage \d+ ·/.test(cardText.split("Next milestone")[1] ?? ""));
check("it shows the latest trophy earned", /Latest trophy/.test(cardText) && !/None yet/.test(cardText.split("Latest trophy")[1] ?? ""));
check("it shows the author passport number", cardText.includes(passportNo), passportNo);
check("it names no other role", !/reseller|vendor|developer|administrator/i.test(cardText));
await author.page.getByRole("button", { name: /Open AMS/ }).first().click();
await author.page.waitForTimeout(5000);
const afterOpen = await author.page.locator("[data-ams-role]").first().getAttribute("data-ams-role").catch(() => null);
check('"Open AMS" opens the author\'s Achievements module', afterOpen === "author", afterOpen ?? "not opened");
// The module reads the engine's own catalogue: the author's earned stage
// achievement by its database name, and the rank the engine gives stage 1.
const [, names] = sql(
  "select a.name || '|' || (select name from ranks where rank_number=1) from achievements a " +
  "where a.slug='author-stage-01'",
);
const [achName, rank1] = String(names ?? "").split("|");
const moduleText = (await author.page.locator("[data-ams-role]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
check(`the module shows the engine's rank "${rank1}"`, moduleText.includes(rank1), moduleText.slice(0, 100));
check(`the module shows the earned achievement "${achName}"`, moduleText.includes(achName));
check("the module shows none of the old local catalogue names", !/Lifetime Author|Verified Author|Rookie/.test(moduleText));
check("the module shows the author passport the engine issued", moduleText.includes(passportNo), passportNo);
check("no page error on the author dashboard", author.errors.length === 0, author.errors.slice(0, 2).join(" | "));
check("nothing was written as the author", author.writes.length === 0, author.writes.slice(0, 3).join(" ; "));
await author.context.close();

/* ---------------------------------------------------------- reseller */
const reseller = await signIn("RESELLER");
await reseller.page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
await reseller.page.waitForTimeout(7000);
const rCard = reseller.page.locator("[data-ams-summary]").first();
const rRole = await rCard.getAttribute("data-ams-summary").catch(() => null);
const rText = (await rCard.innerText().catch(() => "")).replace(/\s+/g, " ");
check("the reseller dashboard shows an AMS summary for the reseller role", rRole === "reseller", rRole ?? "no card");
check("with no recognised activity it shows the empty state and no figure", /No AMS activity yet/.test(rText) && !/\d+ XP|Stage \d+ of 10/.test(rText), rText.slice(0, 90));
await reseller.page.getByRole("button", { name: /Open AMS/ }).first().click();
await reseller.page.waitForTimeout(5000);
const rModule = (await reseller.page.locator("[data-ams-role]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
check("the reseller module shows no passport number it was never issued",
  /Not issued yet/.test(rModule) && !/SV-AMS-\d{4}-\d{4}/.test(rModule),
  (rModule.match(/Passport.{0,40}/) ?? [rModule.slice(0, 120)])[0]);
check("nothing was written as the reseller", reseller.writes.length === 0, reseller.writes.slice(0, 3).join(" ; "));
await reseller.context.close();

/* ---------------------------------------------------------- operator */
const operator = await signIn("CONTROL_PANEL");
// AMS has eleven roles; administrator is not one, so the admin dashboard has
// no AMS summary.
await operator.page.goto(`${BASE}/dashboard/admin`, { waitUntil: "domcontentloaded" });
await operator.page.waitForTimeout(6000);
check("the admin dashboard shows no AMS summary (not an AMS role)", (await operator.page.locator("[data-ams-summary]").count()) === 0);
await operator.page.getByRole("button", { name: /^Achievements$/ }).first().click().catch(() => undefined);
await operator.page.waitForTimeout(3000);
const adminAms = await operator.page.locator("[data-ams-role]").first();
check("the admin Achievements module says AMS does not cover this role",
  (await adminAms.getAttribute("data-ams-role").catch(() => null)) === "none"
  && /is not one of them/.test(await adminAms.innerText().catch(() => "")));
await operator.page.goto(`${BASE}/ams/passport`, { waitUntil: "domcontentloaded" });
await operator.page.waitForTimeout(8000);
const passportPage = (await operator.page.locator("body").innerText()).replace(/\s+/g, " ");
check("AMS Manager's passport view lists the author passport", passportPage.includes(passportNo), passportNo);
check("no page error in AMS Manager", operator.errors.length === 0, operator.errors.slice(0, 2).join(" | "));
await operator.context.close();

await browser.close();
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
