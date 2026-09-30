/**
 * AMS recognition, end to end, on the real database and in a real browser.
 *
 *   node scripts/ops/ams-recognition-verify.mjs [base]
 *
 * Needs supabase/migrations/20261107T100000_ams_recognition_events.sql applied.
 *
 * Uses the reseller test account. Events go through ams_ingest_event - the
 * same entry every business hook uses - with entities named for this run, and
 * everything the run created for that account is removed at the end.
 * The two checks that must break something on purpose (a notification failure
 * and its repair; a second role) run inside a transaction that is rolled back.
 *
 *   1  a real event -> ledger -> notification -> screen -> animation, sound, seen
 *   2  the same event again: nothing new
 *   3  a refresh: nothing replays
 *   4  two tabs: shown in one
 *   5  offline, then back: shown once
 *   6/7 two events at once: queued by priority, one at a time, no stray sound
 *   12 a second role: its own ledger, its own passport, nothing crosses
 *   13/14 notifying fails: the event still counts, the failure is recorded, the
 *      sweep's repair notifies once, a second repair adds nothing, XP paid once
 *   15 certificates: one per award, shown with the database number, verifiable
 *   16/17 XP on screen equals the database; nothing to self-verify
 *   18 a notification forged by the user shows nothing; admin has no AMS
 * Presentation details (mute, volume, reduced motion, phone, keyboard) are in
 * ams-recognition-ui-verify.mjs, which drives the same overlay.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const RUN = `ams-verify-${Date.now()}`;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(76)} ${detail}`);
};

/** SQL through the ops tool; any psql ERROR is a failure, not a silent pass. */
function sql(q) {
  // psql reports errors on stderr and db.mjs still exits 0, so both are read.
  const r = spawnSync("node", ["scripts/ops/db.mjs", "--sql", q], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = r.stdout ?? "";
  if (/\bERROR:/.test(`${out}\n${r.stderr ?? ""}`)) throw new Error(`${r.stderr ?? ""}${out}`.slice(0, 800));
  return out.split("\n").map((l) => l.trim()).filter((l) => l && !/^target|^-+(\+-+)*$|rows?\)$/.test(l));
}
const one = (q) => sql(q)[1] ?? "";

const RESELLER = "(select id from auth.users where email='test.reseller@softwarevala.test')";
const ingest = (key, entity) =>
  `select ams_ingest_event(${RESELLER}, '${key}', 'verification', '${RUN}:${entity}', 1, now(), 'verification', '{"ams_role":"reseller"}'::jsonb)`;
const since = `(select min(created_at) from ams_activity_events where entity_id like '${RUN}:%')`;
const ledgerCount = () => Number(one(`select count(*) from ams_award_ledger where user_id=${RESELLER}`));
const noteCount = () => Number(one(`select count(*) from user_notifications where user_id=${RESELLER} and event_type like 'ams.recognition.%'`));

if (one("select to_regclass('public.ams_recognition_presentations') is not null") !== "t") {
  console.log("  The recognition migration is not applied (20261107T100000_ams_recognition_events.sql). Nothing to verify.");
  process.exit(2);
}

// The clean-up removes exactly what this run created, which is only exact when
// the account starts with no AMS record of its own. Refuse rather than guess.
const prior = one(`select count(*) from ams_activity_events where user_id=${RESELLER}`);
if (prior !== "0") {
  console.log(`  The reseller test account already has ${prior} AMS event(s); run against a clean account.`);
  process.exit(2);
}

const AUDIO_PROBE = () => {
  const sv = (window.__sv = { starts: [], kinds: [], overlays: 0, maxOverlays: 0 });
  for (const Node of [OscillatorNode, AudioBufferSourceNode]) {
    const start = Node.prototype.start;
    Node.prototype.start = function (...a) {
      sv.starts.push(performance.now());
      return start.apply(this, a);
    };
  }
  const watch = () =>
    new MutationObserver(() => {
      const els = document.querySelectorAll("[data-recognition-overlay]");
      sv.maxOverlays = Math.max(sv.maxOverlays, els.length);
      const kind = els[0]?.getAttribute("data-recognition-overlay") ?? null;
      const last = sv.kinds[sv.kinds.length - 1];
      if (kind && (!last || last.ended)) sv.kinds.push({ kind, at: performance.now(), text: els[0].textContent });
      if (!kind && last && !last.ended) last.ended = performance.now();
    }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) watch();
  else document.addEventListener("readystatechange", watch, { once: true });
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
async function signIn(login) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await context.addInitScript(AUDIO_PROBE);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);
  await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]);
  await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  return { context, page, errors };
}
const shown = (page) => page.evaluate(() => window.__sv.kinds.map((k) => k.kind));
const probe = (page) => page.evaluate(() => window.__sv);
async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
/** Dismiss whatever is on screen, and whatever queues behind it. */
async function drain(page, ms = 40_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await page.locator("[data-recognition-overlay]").count()) === 0) {
      await page.waitForTimeout(1500);
      if ((await page.locator("[data-recognition-overlay]").count()) === 0) return;
    }
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(900);
  }
}

let cleanupNeeded = false;
try {
  const reseller = await signIn("RESELLER");
  const { page } = reseller;
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  const token = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => /auth-token$/.test(x));
    return k ? JSON.parse(localStorage.getItem(k) ?? "{}").access_token ?? null : null;
  });
  const mode = await page.evaluate(async (t) => {
    const ac = new AbortController();
    const r = await fetch("/api/notifications/stream", { headers: { Authorization: `Bearer ${t}` }, signal: ac.signal });
    ac.abort();
    return r.status;
  }, token);
  console.log(`  delivery: ${mode === 200 ? "live stream" : `periodic (stream answered ${mode})`}`);
  const WAIT = mode === 200 ? 15_000 : 40_000;

  /* ---------------------------------------------------------- 1 */
  const ledgerBefore = ledgerCount();
  const notesBefore = noteCount();
  cleanupNeeded = true;
  const r1 = one(ingest("lead.converted", "1"));
  check("1  a qualifying event is accepted by the engine", /"ok": true/.test(r1) && /"duplicate": false/.test(r1), r1.slice(0, 90));
  const newLines = ledgerCount() - ledgerBefore;
  const newNotes = noteCount() - notesBefore;
  check("1  the engine wrote its recognitions to the ledger", newLines >= 2, `+${newLines}`);
  check("1  every recognition became exactly one notification", newNotes === newLines, `ledger +${newLines}, notifications +${newNotes}`);
  const keys = Number(one(`select count(distinct dedupe_key) from user_notifications where user_id=${RESELLER} and created_at >= ${since} and event_type like 'ams.recognition.%'`));
  check("1  each notification is keyed to its ledger line", keys === newNotes, `${keys} keys`);
  const appeared = await waitFor(async () => (await shown(page)).length > 0, WAIT);
  const p1 = await probe(page);
  check("1  the recognition reached the screen", appeared, JSON.stringify(p1.kinds.map((k) => k.kind)));
  check("1  it played sound as it began", p1.starts.some((t) => p1.kinds[0] && t >= p1.kinds[0].at - 100 && t <= p1.kinds[0].at + 2500), `${p1.starts.length} starts`);
  const extras = await page.locator("[data-recognition-extras] li").count();
  check("1  one presentation carried the whole moment", p1.kinds.length === 1 && extras >= 1, `presentations=${p1.kinds.length} also-earned=${extras}`);
  await drain(page);
  const presented = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.user_id=${RESELLER} and l.created_at >= ${since} and p.client='browser'`));
  check("1  every line is marked shown, once", presented === newNotes, `${presented}/${newNotes}`);

  /* ---------------------------------------------------------- 2 */
  const before2 = [ledgerCount(), noteCount()];
  const r2 = one(ingest("lead.converted", "1"));
  check("2  the same event again is refused as a duplicate", /"duplicate": true/.test(r2));
  check("2  and writes nothing", ledgerCount() === before2[0] && noteCount() === before2[1]);
  await page.waitForTimeout(WAIT);
  check("2  and shows nothing", (await shown(page)).length === 1);

  /* ---------------------------------------------------------- 3 */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(WAIT);
  check("3  a refresh replays nothing", (await shown(page)).length === 0);

  /* ---------------------------------------------------------- 4 */
  const second = await reseller.context.newPage();
  await second.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await second.waitForTimeout(6000);
  one(ingest("order.paid", "2"));
  await waitFor(async () => (await shown(page)).length + (await shown(second)).length > 0, WAIT);
  await page.waitForTimeout(3000);
  const tabs = [(await shown(page)).length, (await shown(second)).length];
  check("4  with two tabs open, it is shown in exactly one", tabs[0] + tabs[1] === 1, `tabs ${tabs.join(" + ")}`);
  await drain(page); await drain(second);
  await second.close();

  /* ---------------------------------------------------------- 5 */
  const shownBefore5 = (await shown(page)).length;
  await reseller.context.setOffline(true);
  one(ingest("lead.captured", "3"));
  await page.waitForTimeout(5000);
  await reseller.context.setOffline(false);
  await waitFor(async () => (await shown(page)).length > shownBefore5, WAIT + 30_000);
  await page.waitForTimeout(4000);
  check("5  after going offline and back, it is shown exactly once", (await shown(page)).length - shownBefore5 === 1, `${(await shown(page)).length - shownBefore5}`);
  await drain(page);

  /* ---------------------------------------------------------- 6/7 */
  await page.evaluate(() => { window.__sv.kinds = []; window.__sv.starts = []; window.__sv.maxOverlays = 0; });
  // Two separate transactions, milliseconds apart: XP only, then a promotion.
  sql(`${ingest("lead.converted", "4")}; ${ingest("lead.converted", "5")};`);
  await waitFor(async () => (await shown(page)).length >= 2, WAIT + 30_000);
  await drain(page, 60_000);
  const p6 = await probe(page);
  const order = p6.kinds.map((k) => k.kind);
  check("6  two moments become two presentations", order.length === 2, order.join(" > "));
  check("6  the promotion leads, the plain XP waits", order.length === 2 && order[1] === "xp" && order[0] !== "xp", order.join(" > "));
  check("7  never two on screen at once", p6.maxOverlays === 1, `max ${p6.maxOverlays}`);
  const stray = p6.starts.filter((t) => !p6.kinds.some((k) => t >= k.at - 100 && t <= k.at + 2500));
  check("7  no sound outside a presentation's start", stray.length === 0, `${stray.length}/${p6.starts.length}`);

  /* ---------------------------------------------------------- 15 */
  const certs = sql(`select certificate_no from ams_certificates where user_id=${RESELLER} and role='reseller' order by stage`).slice(1);
  const awards = Number(one(`select count(*) from user_awards ua join awards a on a.id=ua.award_id where ua.user_id=${RESELLER} and a.conditions->>'role'='reseller'`));
  check("15 one certificate per award, each numbered", certs.length === awards && certs.every((c) => /^SV-CRT-/.test(c)), `${certs.length} certificates, ${awards} awards`);
  check("15 certificate numbers are unique", new Set(certs).size === certs.length);
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.getByRole("button", { name: /Open AMS/ }).first().click();
  await page.waitForTimeout(4000);
  const module = page.locator("[data-ams-role]").first();
  const xpDb = one(`select total_xp from user_xp where user_id=${RESELLER} and role='reseller'`);
  check("16 the XP on screen is the database's", (await module.innerText()).includes(`${Number(xpDb).toLocaleString("en-US")} XP`), `${xpDb} XP`);
  const nav = (n) => module.getByRole("button", { name: new RegExp(`^${n}$`) }).first();
  if (await nav("Certificates").isEnabled().catch(() => false)) {
    await nav("Certificates").click();
    await page.waitForTimeout(1200);
    const onScreen = await module.locator("[data-certificate-no]").evaluateAll((els) => els.map((e) => e.getAttribute("data-certificate-no")).filter(Boolean));
    check("15 the module shows the database's certificate numbers", certs.every((c) => onScreen.includes(c)), onScreen.join(", "));
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }).catch(() => null),
      module.getByRole("button", { name: /^Download$/ }).first().click(),
    ]);
    const body = dl ? JSON.parse(readFileSync(await dl.path(), "utf8")) : null;
    check("15 the downloaded certificate is the database's", body && certs.includes(body.certificateNo), body?.certificateNo ?? "no download");
  } else {
    check("15 the Certificates section is open at this stage", false, "locked");
  }
  await page.goto(`${BASE}/verify/${certs[0]}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  check("15 a certificate number verifies as valid", (await page.locator("[data-certificate-verify]").getAttribute("data-certificate-verify")) === "valid");
  await page.goto(`${BASE}/verify/SV-CRT-0000-0000-0000-RES01`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  check("15 an unknown number does not", (await page.locator("[data-certificate-verify]").getAttribute("data-certificate-verify")) === "invalid");

  /* ---------------------------------------------------------- 18 */
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const foreign = one(`select id from ams_award_ledger where user_id=(select id from auth.users where email='test.author@softwarevala.test') limit 1`);
  const forged = await page.evaluate(async ({ t, foreignId, run, base, key }) => {
    const h = { Authorization: `Bearer ${t}`, "Content-Type": "application/json", apikey: key };
    const uid = JSON.parse(atob(t.split(".")[1])).sub;
    const ins = await fetch(`${base}/rest/v1/user_notifications`, {
      method: "POST", headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: uid, type: "success", message: "Trophy earned: forged", event_type: "ams.recognition.trophy", dedupe_key: `${run}:forged`, data: { ledger_id: foreignId } }),
    });
    const claim = await fetch(`${base}/rest/v1/rpc/ams_recognition_claim`, { method: "POST", headers: h, body: JSON.stringify({ p_ledger_ids: [foreignId] }) });
    const peek = await fetch(`${base}/rest/v1/ams_recognition_presentations?select=ledger_id&ledger_id=eq.${foreignId}`, { headers: h });
    return { inserted: ins.status, claim: await claim.json(), peek: await peek.json() };
  }, { t: token, foreignId: foreign, run: RUN, base: ops.SV_API_BASE ?? "https://softwarevala.net", key: ops.SUPABASE_PUBLISHABLE_KEY });
  check("18 a user cannot claim someone else's recognition", Array.isArray(forged.claim?.claimed) && forged.claim.claimed.length === 0, JSON.stringify(forged.claim).slice(0, 80));
  check("18 nor read whether it was shown", Array.isArray(forged.peek) && forged.peek.length === 0, JSON.stringify(forged.peek).slice(0, 60));
  await page.waitForTimeout(WAIT);
  check("18 a notification the user wrote themselves shows nothing", (await shown(page)).length === 0, `insert ${forged.inserted}`);
  check("no page error for the reseller", reseller.errors.length === 0, reseller.errors.slice(0, 2).join(" | "));
  await reseller.context.close();

  const admin = await signIn("CONTROL_PANEL");
  await admin.page.goto(`${BASE}/dashboard/admin`, { waitUntil: "domcontentloaded" });
  await admin.page.waitForTimeout(8000);
  check("18 the admin dashboard has no AMS summary", (await admin.page.locator("[data-ams-summary]").count()) === 0);
  check("18 and nothing is presented to the admin", (await shown(admin.page)).length === 0);
  await admin.context.close();

  /* ---------------------------------------------------------- 12, 13/14 (rolled back) */
  const txn = sql(`
    begin;
    insert into user_roles (user_id, role) select ${RESELLER}, 'vendor' where not exists (select 1 from user_roles where user_id=${RESELLER} and role='vendor');
    select 'vendor_event', ams_ingest_event(${RESELLER}, 'product.published', 'verification', '${RUN}:v1', 1, now(), 'verification', '{"ams_role":"vendor"}'::jsonb)->>'ok';
    select 'vendor_lines', count(*) from ams_award_ledger where user_id=${RESELLER} and role='vendor';
    select 'vendor_passport', count(*) from ams_passports where user_id=${RESELLER} and role='vendor';
    select 'reseller_xp_unchanged', (select total_xp from user_xp where user_id=${RESELLER} and role='reseller') = ${Number(xpDb)};
    select 'vendor_notes_named', count(*) from user_notifications where user_id=${RESELLER} and data->>'role'='vendor' and message like '%(Vendor)%';
    select 'cross_role_lines', count(*) from ams_award_ledger where user_id=${RESELLER} and role='vendor' and asset_slug like 'reseller-%';
    alter table user_notifications add constraint sv_verify_block check (event_type not like 'ams.recognition.%') not valid;
    select 'failing_event', ams_ingest_event(${RESELLER}, 'lead.converted', 'verification', '${RUN}:f1', 1, now(), 'verification', '{"ams_role":"reseller"}'::jsonb)->>'ok';
    select 'failing_lines', count(*) from ams_award_ledger l where l.user_id=${RESELLER} and l.created_at = now();
    select 'failing_notes', count(*) from user_notifications where user_id=${RESELLER} and created_at = now() and event_type like 'ams.recognition.%';
    select 'failures_recorded', count(*) from error_events where fn_name='ams_notify_recognition' and created_at = now();
    alter table user_notifications drop constraint sv_verify_block;
    select 'repair_first', ams_recognition_repair();
    select 'repair_second', ams_recognition_repair();
    select 'xp_paid_once', (select total_xp from user_xp where user_id=${RESELLER} and role='reseller') - ${Number(xpDb)};
    rollback;`);
  const val = (k) => (txn.find((l) => l.startsWith(`${k} `)) ?? "").split("|").pop().trim();
  check("12 an event under a second role is accepted", val("vendor_event") === "true");
  check("12 the second role gets its own recognitions and passport", Number(val("vendor_lines")) > 0 && Number(val("vendor_passport")) === 1, `${val("vendor_lines")} lines`);
  check("12 the first role is untouched", val("reseller_xp_unchanged") === "t");
  check("12 nothing of one role is filed under the other", Number(val("cross_role_lines")) === 0);
  check("12 its notifications name their own role", Number(val("vendor_notes_named")) > 0);
  check("13 a notification failure does not stop the event", val("failing_event") === "true" && Number(val("failing_lines")) > 0, `${val("failing_lines")} lines`);
  check("13 no notification was written, and the failure was recorded", Number(val("failing_notes")) === 0 && Number(val("failures_recorded")) > 0, `recorded ${val("failures_recorded")}`);
  check("14 the repair notifies each missed recognition", Number(val("repair_first")) === Number(val("failing_lines")), `${val("repair_first")}/${val("failing_lines")}`);
  check("14 a second repair adds nothing", Number(val("repair_second")) === 0);
  check("14 XP was paid once", Number(val("xp_paid_once")) === 250, `+${val("xp_paid_once")}`);
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 400) : error}`);
} finally {
  if (cleanupNeeded) {
    // Everything this run created for the test account, and nothing else.
    const out = sql(`
      begin;
      create temp table run_users as select ${RESELLER} as id;
      create temp table run_lines as
        select l.id from ams_award_ledger l, run_users u
         where l.user_id = u.id and l.created_at >= ${since};
      delete from ams_recognition_presentations where ledger_id in (select id from run_lines);
      delete from user_notifications where user_id in (select id from run_users)
        and (dedupe_key in (select 'ams:ledger:' || id::text from run_lines) or dedupe_key like '${RUN}:%');
      alter table ams_award_ledger disable trigger ams_ledger_no_rewrite;
      delete from ams_award_ledger where id in (select id from run_lines);
      alter table ams_award_ledger enable trigger ams_ledger_no_rewrite;
      delete from ams_certificates where user_id in (select id from run_users) and issued_at >= ${since};
      delete from user_awards where user_id in (select id from run_users) and earned_at >= ${since};
      delete from user_badges where user_id in (select id from run_users) and earned_at >= ${since};
      delete from user_trophies where user_id in (select id from run_users) and earned_at >= ${since};
      delete from user_achievements where user_id in (select id from run_users) and unlocked_at >= ${since};
      delete from xp_transactions where user_id in (select id from run_users) and created_at >= ${since};
      delete from ams_passports where user_id in (select id from run_users) and issued_at >= ${since};
      delete from user_xp x using run_users u where x.user_id = u.id and not exists
        (select 1 from ams_activity_events e where e.user_id = u.id and e.role = x.role and e.entity_id not like '${RUN}:%');
      alter table ams_activity_events disable trigger ams_events_no_rewrite;
      delete from ams_activity_events where entity_id like '${RUN}:%';
      alter table ams_activity_events enable trigger ams_events_no_rewrite;
      select 'left', (select count(*) from ams_activity_events where entity_id like '${RUN}:%')
        + (select count(*) from user_notifications where dedupe_key like '${RUN}:%');
      commit;`);
    const left = (out.find((l) => l.startsWith("left ")) ?? "").split("|").pop().trim();
    check("the run's rows were removed", left === "0", `left ${left}`);
    const triggers = one("select string_agg(tgname || '=' || tgenabled, ',') from pg_trigger where tgname in ('ams_ledger_no_rewrite','ams_events_no_rewrite')");
    check("the append-only guards are back on", !/=D/.test(triggers), triggers);
  }
  await browser.close();
}

console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
