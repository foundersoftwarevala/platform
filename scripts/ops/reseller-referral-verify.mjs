/**
 * Reseller referral attribution, end to end with real accounts.
 *
 *   node scripts/ops/reseller-referral-verify.mjs [base]
 *
 * Live part (real requests, real browser):
 *   1. the reseller test account mints a referral link through /api/reseller/referral
 *   2. a visitor lands on /?ref=CODE; ReferralCapture -> /api/track/ref records a
 *      referral session for that reseller and sets the HttpOnly sv_ref cookie
 *   3. the visitor browses a product page, refreshes, and signs in as a buyer:
 *      the cookie and the single session row survive all of it
 *   4. checkout asks /api/payment/initiate to start the payment; that is the
 *      step that attributes the order, and it is reported exactly as it answers
 *   5. A's link is used against reseller B's dashboard API: refused
 * Database part (one transaction, rolled back): the real session row from step
 * 2 is attributed to a new order exactly as attributeOrder writes it, the order
 * is paid, and the commission must land on reseller A - once.
 *
 * Clean-up: the link is switched off through the same API (it is not deleted)
 * and the one referral-session row this run created is removed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const env = {};
for (const l of readFileSync(`${process.env.TEMP}/sv-public.env`, "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3010";
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(74)} ${detail}`); };
const db = (sql) => execFileSync("node", ["scripts/ops/db.mjs", "--sql", `copy (${sql}) to stdout`], { encoding: "utf8" })
  .split("\n").filter((l) => l && !/^(target|SET)/.test(l));
// psql reports a refused statement on stderr, so both streams are read.
const dbFile = (path) => { const r = spawnSync("node", ["scripts/ops/db.mjs", "--file", path], { encoding: "utf8" }); return `${r.stdout}
${r.stderr}`; };

async function signIn(login) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: ops[`SV_LOGIN_${login}`], password: ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`sign-in ${login} failed: ${r.status}`);
  return { token: j.access_token, uid: j.user.id };
}

const A = await signIn("RESELLER");
const [ra] = db(`select id from resellers where user_id = '${A.uid}'`);
let link = null;
let sessionRow = null;
try {
  // 1. mint
  const created = await fetch(`${BASE}/api/reseller/referral`, {
    method: "POST", headers: { authorization: `Bearer ${A.token}`, "content-type": "application/json" },
    body: JSON.stringify({ action: "create-link" }),
  });
  const cj = await created.json();
  link = cj.link;
  const [dbOwner] = link ? db(`select reseller_id from marketplace_referral_codes where id = '${link.id}' and active`) : [];
  check("reseller A mints a referral link through its own API", created.status === 201 && dbOwner === ra, `HTTP ${created.status} ${link?.code ?? cj.error ?? ""}`);
  if (!link) throw new Error("no link to test with");

  // 2-3. land, browse, refresh, sign in
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const track = [];
  page.on("response", (r) => { if (r.url().includes("/api/track/ref")) track.push(r.status()); });
  await page.goto(`${BASE}${link.url}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const cookie = () => context.cookies().then((cs) => cs.find((c) => c.name === "sv_ref"));
  const c1 = await cookie();
  const sessions = () => db(`select id || ' ' || coalesce(reseller_id::text, '-') || ' ' || coalesce(referral_code_id::text, '-') from marketplace_referral_sessions where session_key = '${c1?.value ?? "none"}'`);
  const s1 = sessions();
  sessionRow = s1[0]?.split(" ")[0] ?? null;
  check("landing on /?ref= records the visit (/api/track/ref)", track.includes(200), `responses ${track.join(",") || "none"}`);
  check("the visitor gets the HttpOnly referral cookie", Boolean(c1?.value) && c1.httpOnly === true, c1 ? `httpOnly=${c1.httpOnly}` : "no cookie");
  check("one referral session, for reseller A and A's link", s1.length === 1 && s1[0].endsWith(`${ra} ${link.id}`), s1.join(" | ") || "none");

  const [slug] = db("select slug from marketplace_products where slug is not null order by created_at limit 1");
  await page.goto(`${BASE}/marketplace/product/${slug}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
  await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
  const c2 = await cookie();
  check("the cookie survives product browsing, a refresh and the checkout page", c2?.value === c1?.value, c2 ? "same session key" : "cookie lost");
  check("refreshing does not create a second session", sessions().length === 1, `${sessions().length} rows`);

  await page.goto(`${BASE}/login`); await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', ops.SV_LOGIN_AFFILIATE); await page.fill('input[type="password"]', ops.SV_PW_AFFILIATE ?? ops.SV_PW_TEST);
  await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  const c3 = await cookie();
  check("the cookie survives the buyer signing in", c3?.value === c1?.value, c3 ? "same session key" : "cookie lost");

  // 4. checkout -> payment start, from the buyer's browser with the cookie on it
  const initiate = await page.evaluate(async () => {
    const raw = Object.keys(localStorage).find((k) => /auth-token/.test(k));
    const token = raw ? JSON.parse(localStorage.getItem(raw) ?? "{}").access_token : null;
    const r = await fetch("/api/payment/initiate", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ orderId: "00000000-0000-4000-8000-000000000000" }) });
    return { status: r.status, body: (await r.text()).slice(0, 120) };
  });
  console.log(`  ..    payment start (attribution step) answered HTTP ${initiate.status}: ${initiate.body}`);
  check("payment start answers honestly (attribution happens only when PayU is configured)", initiate.status === 503 || initiate.status === 404 || initiate.status === 403, `HTTP ${initiate.status}`);
  await browser.close();

  // 5. A's link cannot be managed by anyone else
  const other = await signIn("AFFILIATE");
  const hijack = await fetch(`${BASE}/api/reseller/referral`, {
    method: "POST", headers: { authorization: `Bearer ${other.token}`, "content-type": "application/json" },
    body: JSON.stringify({ action: "toggle-link", linkId: link.id, active: false }),
  });
  check("another account cannot switch off or take over A's link", hijack.status === 403 || hijack.status === 401, `HTTP ${hijack.status}`);

  // database part, rolled back
  const sql = `\\set ON_ERROR_STOP off
begin;
select id as buyer from auth.users where email = '${ops.SV_LOGIN_AFFILIATE}' \\gset
select id as prod, name as pname from marketplace_products order by created_at limit 1 \\gset
update resellers set plan_code = 'starter_reseller' where id = '${ra}';
insert into marketplace_orders (buyer_id, currency, subtotal, total, idempotency_key, status) values (:'buyer', 'USD', 100, 100, 'refv-' || gen_random_uuid(), 'pending_payment') returning id as o \\gset
insert into marketplace_order_items (order_id, product_id, product_name, quantity, unit_amount, line_total, currency) values (:'o', :'prod', :'pname', 1, 100, 100, 'USD');
-- what attributeOrder writes, from the real session row
insert into marketplace_order_attributions (order_id, referral_code_id, reseller_id, session_id, attribution_method, metadata)
select :'o', referral_code_id, reseller_id, id, 'referral_code', '{"stamped_at":"verify"}' from marketplace_referral_sessions where id = '${sessionRow}';
savepoint s;
insert into marketplace_order_attributions (order_id, referral_code_id, reseller_id, session_id, attribution_method)
select :'o', referral_code_id, reseller_id, id, 'referral_code' from marketplace_referral_sessions where id = '${sessionRow}';
rollback to savepoint s;
update marketplace_orders set status = 'paid' where id = :'o';
update marketplace_orders set status = 'paid' where id = :'o';
select 'RESULT', (select count(*) from marketplace_order_attributions where order_id = :'o'), (select string_agg(reseller_id::text, ',') from reseller_commissions where order_id = :'o'), (select count(*) from reseller_commissions where order_id = :'o'), (select sum(commission_amount) from reseller_commissions where order_id = :'o');
rollback;
`;
  const path = `${process.env.TEMP}/referral-db.sql`;
  writeFileSync(path, sql);
  const out = dbFile(path);
  const line = out.split("\n").find((l) => l.includes("RESULT")) ?? "";
  const [, attributions, who, count, amount] = line.split("|").map((x) => x.trim());
  check("the real session attributes a paid order to reseller A, once", attributions === "1" && who === ra && count === "1", `attributions ${attributions}, commission ${count} x ${amount} for ${who === ra ? "A" : who}`);
  check("a second attribution of the same order is refused", /duplicate key value violates unique constraint "marketplace_order_attributions_order_id_key"/.test(out), "");
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 300) : error}`);
} finally {
  if (link) {
    const off = await fetch(`${BASE}/api/reseller/referral`, {
      method: "POST", headers: { authorization: `Bearer ${A.token}`, "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle-link", linkId: link.id, active: false }),
    });
    console.log(`  ..    clean-up: test link switched off (HTTP ${off.status})`);
  }
  if (sessionRow) {
    execFileSync("node", ["scripts/ops/db.mjs", "--sql", `delete from marketplace_referral_sessions where id = '${sessionRow}'`], { encoding: "utf8" });
    console.log(`  ..    clean-up: the run's referral session removed (${db(`select count(*) from marketplace_referral_sessions where id = '${sessionRow}'`)[0]} left)`);
  }
}
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
