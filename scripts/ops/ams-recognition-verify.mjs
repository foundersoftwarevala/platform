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
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
// --cleanup <run-id>: remove what an interrupted run left behind, and nothing else.
const cleanupAt = process.argv.indexOf("--cleanup");
const CLEANUP_ONLY = cleanupAt >= 0;
const RUN = CLEANUP_ONLY ? String(process.argv[cleanupAt + 1] ?? "") : `ams-verify-${Date.now()}`;
if (!/^ams-verify-[0-9]+$/.test(RUN)) {
  console.log(`  not a run id: ${RUN}`);
  process.exit(2);
}
// --fail-chunk: fail the second claim chunk of the 100+ line moment once, to
// prove it is retried and the first chunk is not lost with it.
const FAIL_CHUNK = process.argv.includes("--fail-chunk");
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(76)} ${detail}`);
};

/** SQL through the ops tool; any psql ERROR is a failure, not a silent pass. */
function sql(q) {
  // psql reports errors on stderr and db.mjs still exits 0, so both are read.
  // The VPS's ssh sometimes refuses a connection. When the connection or the
  // copy of the SQL file failed, nothing reached the database, so that - and
  // only that - is retried.
  let r;
  for (let attempt = 1; ; attempt++) {
    r = spawnSync("node", ["scripts/ops/db.mjs", "--sql", q], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const unreached = /ssh: connect to host .* (timed out|refused)|scp: Connection closed|Connection reset by peer|kex_exchange_identification/.test(`${r.stdout ?? ""}${r.stderr ?? ""}`);
    if (!unreached || attempt === 4) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000 * attempt);
  }
  const out = r.stdout ?? "";
  if (r.status !== 0 || /\b(ERROR|FATAL|PANIC):|permission denied/i.test(`${out}\n${r.stderr ?? ""}`)) {
    throw new Error(`${r.stderr ?? ""}${out}`.slice(0, 800));
  }
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
if (!CLEANUP_ONLY && prior !== "0") {
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
let streamType = "";
try {
  if (CLEANUP_ONLY) {
    cleanupNeeded = true;
    throw Object.assign(new Error("cleanup only"), { cleanupOnly: true });
  }
  const reseller = await signIn("RESELLER");
  let { page } = reseller;
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  const token = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => /auth-token$/.test(x));
    return k ? JSON.parse(localStorage.getItem(k) ?? "{}").access_token ?? null : null;
  });
  const mode = await page.evaluate(async (t) => {
    const ac = new AbortController();
    const r = await fetch("/api/notifications/stream", { headers: { Authorization: `Bearer ${t}` }, signal: ac.signal });
    const type = r.headers.get("content-type") ?? "";
    ac.abort();
    return { status: r.status, type };
  }, token).then((m) => { streamType = m.type; return m.status; });
  console.log(`  delivery: ${mode === 200 ? "live stream" : `periodic (stream answered ${mode})`}`);
  const WAIT = mode === 200 ? 15_000 : 40_000;

  // The stream itself, read raw alongside the app: what the database announced
  // and the server delivered to this person, by ledger id. A second person's
  // stream is read the same way and must receive none of it.
  const RAW = async (t) => {
    window.__raw = [];
    const r = await fetch("/api/notifications/stream", { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok || !r.body) return r.status;
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = block.match(/^data: (.*)$/m);
          if (/^event: notification$/m.test(block) && data) window.__raw.push(JSON.parse(data[1]));
        }
      }
    })();
    return r.status;
  };
  const tokenOf = (p) => p.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => /auth-token$/.test(x));
    return k ? JSON.parse(localStorage.getItem(k) ?? "{}").access_token ?? null : null;
  });
  const bystander = await signIn("AUTHOR");
  await bystander.page.goto(`${BASE}/dashboard/author`, { waitUntil: "domcontentloaded" });
  await bystander.page.waitForTimeout(4000);
  if (mode === 200) {
    await page.evaluate(RAW, token);
    await bystander.page.evaluate(RAW, await tokenOf(bystander.page));
  }

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
  // Read from the text captured as it appeared: by now it may have closed.
  const t1 = String(p1.kinds[0]?.text ?? "");
  const alsoEarned = (t1.split("Also earned")[1] ?? "").match(/(Achievement|Badge|Trophy|Award|Certificate|Passport) · /g)?.length ?? 0;
  check("1  one presentation carried the whole moment", p1.kinds.length === 1 && alsoEarned === newLines - 2, `presentations=${p1.kinds.length}, also earned ${alsoEarned} of ${newLines - 2} (headline and XP aside)`);
  check("1  it names the stage, rank and XP from the database", /Stage 2 of 10/.test(t1) && /Rank Developing/.test(t1) && /\+250 XP/.test(t1), t1.slice(0, 90));
  check("1  it claims no rarity the stage does not have", !/Legendary ·|Mythic ·|Epic ·/.test(t1.split("Also earned")[0]), t1.slice(0, 40));
  await drain(page);
  const presented = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.user_id=${RESELLER} and l.created_at >= ${since} and p.client='browser'`));
  check("1  every line is marked shown, once", presented === newNotes, `${presented}/${newNotes}`);
  if (mode === 200) {
    const dbIds = sql(`select id from ams_award_ledger where user_id=${RESELLER} and created_at >= ${since}`).slice(1);
    const got = await page.evaluate(() => window.__raw.map((e) => e.ledger_id));
    check("9  the stream delivered every ledger id the database announced", dbIds.length > 0 && dbIds.every((id) => got.includes(id)), `${got.length}/${dbIds.length}`);
    const theirs = await bystander.page.evaluate(() => window.__raw.length);
    check("9  another signed-in person's stream received none of it", theirs === 0, `${theirs}`);
    check("9  and nothing was presented to them", (await shown(bystander.page)).length === 0);
  } else {
    check("9  live stream available for this run", false, `stream answered ${mode}; delivery was periodic`);
  }

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

  /* ---------------------------------------------------------- 8: concurrent submission */
  // Both submissions must reach the database for this to mean anything; if
  // ssh drops either, the pair is sent again as a new event.
  let concurrent = [];
  let cEntity = "c1";
  for (let attempt = 1; attempt <= 3; attempt++) {
    cEntity = `c1-${attempt}`;
    concurrent = await Promise.all([0, 1].map(() => new Promise((resolve) => {
      const child = spawn("node", ["scripts/ops/db.mjs", "--sql", ingest("lead.captured", cEntity)], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (d) => { out += d; });
      child.stderr.on("data", (d) => { out += d; });
      child.on("close", () => resolve(out));
    })));
    if (concurrent.every((o) => /"ok": true/.test(o))) break;
  }
  const accepted = concurrent.filter((o) => /"duplicate": false/.test(o)).length;
  const refused = concurrent.filter((o) => /"duplicate": true/.test(o)).length;
  check("8  the same event sent twice at once lands once", accepted === 1 && refused === 1, `accepted ${accepted}, duplicate ${refused}`);
  const c1Lines = Number(one(`select count(*) from ams_award_ledger l join ams_activity_events e on e.id = l.event_id where e.entity_id='${RUN}:${cEntity}'`));
  check("8  and pays once", c1Lines === 1, `${c1Lines} XP line(s)`);
  await waitFor(async () => (await shown(page)).length > 0, WAIT);
  await drain(page);

  /* ---------------------------------------------------------- 4 */
  const second = await reseller.context.newPage();
  await second.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await second.waitForTimeout(6000);
  // Count only what this event brings, in each tab.
  for (const p of [page, second]) await p.evaluate(() => { window.__sv.kinds = []; });
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

  /* ---------------------------------------------------------- 11/12: refresh mid-queue */
  // Two plain-XP moments at once (same priority: first come, first served).
  // The page is reloaded as soon as the first shows; the second, not yet
  // shown, must still be shown after the reload, and the first must not be.
  await page.evaluate(() => { window.__sv.kinds = []; });
  sql(`${ingest("lead.converted", "6")}; ${ingest("order.paid", "7")};`);
  await waitFor(async () => (await shown(page)).length > 0, WAIT + 30_000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitFor(async () => (await shown(page)).length > 0, WAIT + 30_000);
  await drain(page, 40_000);
  const afterReload = (await shown(page)).length;
  const moment6 = `(select min(l.created_at) from ams_award_ledger l join ams_activity_events e on e.id=l.event_id where e.entity_id in ('${RUN}:6','${RUN}:7'))`;
  const unseen67 = Number(one(`select count(*) from ams_award_ledger l where l.user_id=${RESELLER} and l.created_at >= ${moment6} and not exists (select 1 from ams_recognition_presentations p where p.ledger_id=l.id)`));
  check("11 a refresh mid-queue loses nothing: the waiting one still shows", afterReload === 1 && unseen67 === 0, `after reload ${afterReload}, unseen ${unseen67}`);

  // The tab closes; a recognition arrives; a new tab opens and shows it once.
  await page.close();
  one(ingest("lead.captured", "8"));
  const reopened = await reseller.context.newPage();
  await reopened.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await waitFor(async () => (await shown(reopened)).length > 0, WAIT + 20_000);
  await drain(reopened);
  await reopened.waitForTimeout(3000);
  check("12 granted while no tab was open, it shows once when one opens", (await shown(reopened)).length === 1, `${(await shown(reopened)).length}`);
  await reopened.reload({ waitUntil: "domcontentloaded" });
  await reopened.waitForTimeout(WAIT);
  check("12 and not again after that", (await shown(reopened)).length === 0);
  page = reopened;

  const linesOf = (entities) => `(select l.id from ams_award_ledger l where l.user_id=${RESELLER} and l.created_at in (select l2.created_at from ams_award_ledger l2 join ams_activity_events e on e.id=l2.event_id where e.entity_id in (${entities.map((x) => `'${RUN}:${x}'`).join(",")})))`;
  const claimedOf = (entities) => Number(one(`select count(*) from ams_recognition_presentations where ledger_id in ${linesOf(entities)}`));
  const reset = (p) => p.evaluate(() => { window.__sv.kinds = []; window.__sv.starts = []; window.__sv.maxOverlays = 0; });
  const hide = (p, hidden) => p.evaluate((h) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

  /* ---------------------------------------------------------- B: hidden tab */
  await reset(page);
  await hide(page, true);
  one(ingest("lead.captured", "b1"));
  await page.waitForTimeout(WAIT);
  check("B  a hidden tab shows nothing", (await shown(page)).length === 0);
  check("B  and claims nothing: the recognition stays unseen", claimedOf(["b1"]) === 0);
  await hide(page, false);
  await waitFor(async () => (await shown(page)).length > 0, WAIT);
  await drain(page);
  check("B  back in view, it is shown once and claimed", (await shown(page)).length === 1 && claimedOf(["b1"]) > 0, `${(await shown(page)).length}`);

  /* ---------------------------------------------------------- C: tab closes before presentation */
  await reset(page);
  sql(`${ingest("lead.captured", "c2")}; ${ingest("lead.captured", "c3")};`);
  await waitFor(async () => (await shown(page)).length > 0, WAIT + 20_000);
  await page.close();
  const reopenedC = await reseller.context.newPage();
  await reopenedC.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await waitFor(async () => (await shown(reopenedC)).length > 0, WAIT + 20_000);
  await drain(reopenedC);
  check("C  closed before its turn, it shows in the next tab, once", (await shown(reopenedC)).length === 1 && claimedOf(["c2", "c3"]) === Number(one(`select count(*) from ${linesOf(["c2", "c3"])} x`)), `${(await shown(reopenedC)).length}`);
  page = reopenedC;

  /* ---------------------------------------------------------- H: two claims at once */
  await page.close();
  one(ingest("lead.captured", "h1"));
  const hIds = sql(`select id from ${linesOf(["h1"])} x`).slice(1);
  const race = await Promise.all([0, 1].map(() => fetch(`${process.env.SV_API_BASE ?? ops.SV_API_BASE ?? "https://softwarevala.net"}/rest/v1/rpc/ams_recognition_claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ops.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_ledger_ids: hIds }),
  }).then((r) => r.json())));
  const wins = race.map((r) => r.claimed?.length ?? -1);
  check("H  two claims at once: one wins every line, the other none", wins.sort().join(",") === `0,${hIds.length}`, wins.join(" / "));
  const arbitrary = await fetch(`${process.env.SV_API_BASE ?? ops.SV_API_BASE ?? "https://softwarevala.net"}/rest/v1/rpc/ams_recognition_peek`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ops.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_ledger_ids: ["00000000-0000-4000-8000-000000000000", crypto.randomUUID()] }),
  }).then((r) => r.json());
  check("14 made-up ledger ids read nothing", arbitrary.recognitions?.length === 0, JSON.stringify(arbitrary).slice(0, 60));
  page = await reseller.context.newPage();
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(WAIT);
  check("H  the losing side shows nothing afterwards", (await shown(page)).length === 0);

  /* ---------------------------------------------------------- J: Skip All */
  await reset(page);
  // j1 crosses into stage 4 (a full presentation, with Skip); j2 and j3 wait behind it.
  sql(`${ingest("lead.converted", "j1")}; ${ingest("lead.captured", "j2")}; ${ingest("lead.captured", "j3")};`);
  const skipBtn = page.getByRole("button", { name: /Skip \d+ more/ });
  const skipSeen = await waitFor(async () => (await skipBtn.count()) > 0 || (await shown(page)).length > 0, WAIT + 20_000);
  // XP-only moments show as a compact notice without a Skip button; tap it
  // away and skip from the full presentation when one is up.
  let skipped = false;
  for (let i = 0; i < 12 && !skipped; i++) {
    if (await skipBtn.count()) { await skipBtn.first().click(); skipped = true; break; }
    await page.waitForTimeout(700);
  }
  await drain(page);
  const jLines = Number(one(`select count(*) from ${linesOf(["j1", "j2", "j3"])} x`));
  check("J  Skip All leaves nothing unseen: skipped recognitions count as seen", skipSeen && claimedOf(["j1", "j2", "j3"]) === jLines, `skip clicked: ${skipped}; ${claimedOf(["j1", "j2", "j3"])}/${jLines}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await reset(page);
  await page.waitForTimeout(WAIT);
  check("J  and they are not presented again", (await shown(page)).length === 0);

  /* ---------------------------------------------------------- K: sound off */
  await page.evaluate(() => localStorage.setItem("ams.sound.prefs", JSON.stringify({ enabled: false, volume: 1, celebrations: true })));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await reset(page);
  one(ingest("lead.captured", "k1"));
  await waitFor(async () => (await shown(page)).length > 0, WAIT);
  const pk = await probe(page);
  await drain(page);
  check("K  sound off: the recognition shows and makes no sound", pk.kinds.length === 1 && pk.starts.length === 0, `shown ${pk.kinds.length}, sounds ${pk.starts.length}`);
  await page.evaluate(() => localStorage.setItem("ams.sound.prefs", JSON.stringify({ enabled: true, volume: 1, celebrations: true })));

  /* ---------------------------------------------------------- L/M: reduced motion on a phone */
  await page.close();
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await phoneCtx.addInitScript(AUDIO_PROBE);
  await phoneCtx.addCookies(await reseller.context.cookies());
  const phone = await phoneCtx.newPage();
  await phone.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await phone.waitForTimeout(3000);
  await phone.fill('input[type="email"]', ops.SV_LOGIN_RESELLER);
  await phone.fill('input[type="password"]', ops.SV_PW_RESELLER ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
  await phone.click('button[type="submit"]');
  await phone.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await phone.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await phone.waitForTimeout(5000);
  sql(`${ingest("lead.converted", "m1")};`);
  await waitFor(async () => (await shown(phone)).length > 0, WAIT);
  const mobile = await phone.evaluate(() => {
    const o = document.querySelector("[data-recognition-overlay]");
    const card = o?.querySelector("h2")?.closest(".rounded-2xl") ?? o;
    const r = card?.getBoundingClientRect();
    return { shown: Boolean(o), canvas: Boolean(o?.querySelector("canvas")), left: r?.left ?? -1, right: r?.right ?? 9999, vw: innerWidth, scroll: document.documentElement.scrollWidth };
  });
  check("L  reduced motion: a real recognition shows without particles", mobile.shown && !mobile.canvas, JSON.stringify(mobile));
  check("M  phone: it fits the screen and nothing scrolls sideways", mobile.left >= 0 && mobile.right <= mobile.vw && mobile.scroll <= mobile.vw, JSON.stringify(mobile));
  await drain(phone);
  await phoneCtx.close();

  /* ---------------------------------------------------------- F: a failed claim is retried, nothing lost */
  // The browser's first claim is made to fail on the wire. The recognition must
  // still be shown - after the retry - and every line claimed exactly once.
  let claimCalls = 0;
  let failedCalls = 0;
  page = await reseller.context.newPage();
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.route("**/rest/v1/rpc/ams_recognition_claim", async (route) => {
    claimCalls += 1;
    if (failedCalls === 0) {
      failedCalls += 1;
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"injected failure"}' });
    }
    return route.continue();
  });
  await reset(page);
  one(ingest("lead.captured", "f1"));
  await waitFor(async () => (await shown(page)).length > 0, WAIT + 15_000);
  await drain(page);
  const fLines = Number(one(`select count(*) from ${linesOf(["f1"])} x`));
  check("F  a claim that failed is retried and the recognition still shown", failedCalls === 1 && claimCalls >= 2 && (await shown(page)).length === 1, `claims ${claimCalls}, failed ${failedCalls}, shown ${(await shown(page)).length}`);
  check("F  and every line claimed exactly once", claimedOf(["f1"]) === fLines, `${claimedOf(["f1"])}/${fLines}`);
  await page.unroute("**/rest/v1/rpc/ams_recognition_claim");

  /* ---------------------------------------------------------- T: writes and reads through the public API */
  // As the signed-in reseller, and as anon, straight at PostgREST: every write
  // to AMS state must be refused, and nothing of another person readable.
  const API = process.env.SV_API_BASE ?? ops.SV_API_BASE ?? "https://softwarevala.net";
  const asUser = { Authorization: `Bearer ${token}`, apikey: ops.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", Prefer: "return=representation" };
  const asAnon = { apikey: ops.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", Prefer: "return=representation" };
  const me = one(`select id from auth.users where email='test.reseller@softwarevala.test'`);
  const authorId = one(`select id from auth.users where email='test.author@softwarevala.test'`);
  const anyAchievement = one(`select id from achievements where slug='reseller-stage-10'`);
  const anyTrophy = one(`select id from trophies where slug='reseller-10'`);
  const anyAward = one(`select id from awards where slug='reseller-award-10'`);
  const anyLine = one(`select id from ams_award_ledger where user_id=${RESELLER} limit 1`);
  const before = one(`select (select count(*) from ams_award_ledger) || '/' || (select coalesce(sum(total_xp),0) from user_xp) || '/' || (select count(*) from user_achievements) || '/' || (select count(*) from user_trophies) || '/' || (select count(*) from user_awards) || '/' || (select count(*) from ams_certificates) || '/' || (select string_agg(passport_no, ',' order by role) from ams_passports) || '/' || (select count(*) from ams_recognition_presentations) || '/' || (select count(*) from ams_activity_events)`);
  const attempts = [
    ["insert a ledger line", "POST", "ams_award_ledger", { user_id: me, role: "reseller", asset_kind: "xp", xp_awarded: 99999, reason: "forged" }],
    ["raise my own XP", "PATCH", `user_xp?user_id=eq.${me}`, { total_xp: 999999 }],
    ["grant myself an achievement", "POST", "user_achievements", { user_id: me, achievement_id: anyAchievement, progress: 100, unlocked_at: new Date().toISOString() }],
    ["grant myself a trophy", "POST", "user_trophies", { user_id: me, trophy_id: anyTrophy }],
    ["grant myself an award", "POST", "user_awards", { user_id: me, award_id: anyAward }],
    ["issue myself a certificate", "POST", "ams_certificates", { user_id: me, role: "reseller", certificate_no: `SV-CRT-FORG-ED00-0000-RES10`, title: "forged", stage: 10 }],
    ["change my passport number", "PATCH", `ams_passports?user_id=eq.${me}`, { passport_no: "SV-AMS-0000-0000-RES" }],
    ["mark a recognition shown", "POST", "ams_recognition_presentations", { ledger_id: anyLine, user_id: me }],
    ["insert an activity event", "POST", "ams_activity_events", { user_id: me, role: "reseller", event_key: "order.paid", dedupe_key: `${RUN}:forged-event` }],
    ["rewrite a ledger line", "PATCH", `ams_award_ledger?id=eq.${anyLine}`, { xp_awarded: 99999 }],
    ["delete a ledger line", "DELETE", `ams_award_ledger?id=eq.${anyLine}`, null],
  ];
  const outcomes = [];
  for (const [what, method, path, body] of attempts) {
    const r = await fetch(`${API}/rest/v1/${path}`, { method, headers: asUser, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    const wrote = r.ok && text.trim() !== "" && text.trim() !== "[]";
    outcomes.push(`${what}: ${r.status}${wrote ? " WROTE" : ""}`);
  }
  const after = one(`select (select count(*) from ams_award_ledger) || '/' || (select coalesce(sum(total_xp),0) from user_xp) || '/' || (select count(*) from user_achievements) || '/' || (select count(*) from user_trophies) || '/' || (select count(*) from user_awards) || '/' || (select count(*) from ams_certificates) || '/' || (select string_agg(passport_no, ',' order by role) from ams_passports) || '/' || (select count(*) from ams_recognition_presentations) || '/' || (select count(*) from ams_activity_events)`);
  check("T  a signed-in user can write none of the AMS state", !outcomes.some((o) => o.endsWith("WROTE")) && before === after, outcomes.filter((o) => o.endsWith("WROTE")).join("; ") || "all refused");
  const reads = {};
  for (const [label, headers, path] of [
    ["another's XP", asUser, `user_xp?select=total_xp&user_id=eq.${authorId}`],
    ["another's ledger", asUser, `ams_award_ledger?select=id&user_id=eq.${authorId}`],
    ["another's passport", asUser, `ams_passports?select=passport_no&user_id=eq.${authorId}`],
    ["another's certificates", asUser, `ams_certificates?select=certificate_no&user_id=eq.${authorId}`],
    ["another's notifications", asUser, `user_notifications?select=id&user_id=eq.${authorId}`],
    ["anon ledger", asAnon, "ams_award_ledger?select=id&limit=5"],
    ["anon XP", asAnon, "user_xp?select=total_xp&limit=5"],
    ["anon passports", asAnon, "ams_passports?select=passport_no&limit=5"],
    ["anon certificates", asAnon, "ams_certificates?select=certificate_no&limit=5"],
    ["anon presentations", asAnon, "ams_recognition_presentations?select=ledger_id&limit=5"],
    ["anon events", asAnon, "ams_activity_events?select=id&limit=5"],
  ]) {
    const r = await fetch(`${API}/rest/v1/${path}`, { headers });
    const j = await r.json().catch(() => null);
    reads[label] = Array.isArray(j) ? j.length : `status ${r.status}`;
  }
  check("T  nobody reads another person's AMS state, and anon reads none", Object.values(reads).every((v) => v === 0 || String(v).startsWith("status 4")), JSON.stringify(reads));
  const anonRpc = await Promise.all(["ams_recognition_peek", "ams_recognition_claim", "ams_recognitions", "ams_recognition_pending"].map((fn) =>
    fetch(`${API}/rest/v1/rpc/${fn}`, { method: "POST", headers: asAnon, body: JSON.stringify(fn === "ams_recognitions" ? { p_role: "reseller" } : fn === "ams_recognition_pending" ? { p_since: new Date().toISOString() } : { p_ledger_ids: [anyLine] }) }).then((r) => r.status)));
  check("T  anon cannot call the recognition functions", anonRpc.every((s) => s === 401 || s === 403 || s === 404), anonRpc.join(","));

  /* ---------------------------------------------------------- S: concurrent sweeps */
  // Events recorded but not yet evaluated, then two sweeps at once: the
  // per-person lock must let one pay and the other find nothing to pay.
  sql(`begin; select set_config('ams.defer_eval', 'on', true);
    select ams_ingest_event(${RESELLER}, 'lead.captured', 'verification', '${RUN}:sw1', 1, now(), 'verification', '{"ams_role":"reseller"}'::jsonb);
    commit;`);
  const pendingSweep = Number(one(`select count(*) from ams_activity_events where entity_id='${RUN}:sw1' and processed_at is null`));
  const sweeps = await Promise.all([0, 1].map(() => new Promise((resolve) => {
    const child = spawn("node", ["scripts/ops/db.mjs", "--sql", "select ams_sweep()"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", () => resolve(out));
  })));
  const sw1Lines = Number(one(`select count(*) from ams_award_ledger l join ams_activity_events e on e.id=l.event_id where e.entity_id='${RUN}:sw1'`));
  const swTx = Number(one(`select count(*) from xp_transactions where user_id=${RESELLER} and metadata->>'entity' = '${RUN}:sw1'`));
  check("S  two sweeps at once pay a pending event exactly once", pendingSweep === 1 && sw1Lines === 1 && swTx === 1 && sweeps.every((o) => /"ok": true/.test(o)), `pending ${pendingSweep}, ledger ${sw1Lines}, xp_tx ${swTx}`);
  await waitFor(async () => (await shown(page)).length > 0, WAIT);
  await drain(page);

  /* ---------------------------------------------------------- A: account switch in the same browser */
  // The reseller's browser signs in as the author. A recognition for the
  // reseller must then reach nobody in that browser.
  const switchPage = await reseller.context.newPage();
  await switchPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await switchPage.evaluate(() => { for (const k of Object.keys(localStorage)) if (/auth-token$/.test(k)) localStorage.removeItem(k); });
  await switchPage.reload({ waitUntil: "domcontentloaded" });
  await switchPage.waitForTimeout(3000);
  await switchPage.fill('input[type="email"]', ops.SV_LOGIN_AUTHOR);
  await switchPage.fill('input[type="password"]', ops.SV_PW_AUTHOR ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
  await switchPage.click('button[type="submit"]');
  await switchPage.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await switchPage.goto(`${BASE}/dashboard/author`, { waitUntil: "domcontentloaded" });
  await switchPage.waitForTimeout(5000);
  for (const p of reseller.context.pages()) await reset(p).catch(() => undefined);
  one(ingest("lead.captured", "sw2"));
  await switchPage.waitForTimeout(WAIT);
  const leaked = (await Promise.all(reseller.context.pages().map((p) => shown(p).catch(() => [])))).reduce((a, s) => a + s.length, 0);
  check("A  after switching to another account, the first account's recognition reaches no tab", leaked === 0 && claimedOf(["sw2"]) === 0, `shown ${leaked}, claimed ${claimedOf(["sw2"])}`);
  // Back to the reseller for the rest of the run; the unseen one is shown then.
  await switchPage.evaluate(() => { for (const k of Object.keys(localStorage)) if (/auth-token$/.test(k)) localStorage.removeItem(k); });
  await switchPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await switchPage.waitForTimeout(3000);
  await switchPage.fill('input[type="email"]', ops.SV_LOGIN_RESELLER);
  await switchPage.fill('input[type="password"]', ops.SV_PW_RESELLER ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
  await switchPage.click('button[type="submit"]');
  await switchPage.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  for (const p of reseller.context.pages()) if (p !== switchPage) await p.close();
  page = switchPage;
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await waitFor(async () => (await shown(page)).length > 0, WAIT);
  await drain(page);
  check("A  signed back in, that recognition is shown once to its owner", claimedOf(["sw2"]) > 0);

  /* ---------------------------------------------------------- 13: exact sizes */
  // One moment of exactly N lines, for N at and around the server's 50-id
  // chunk. Engine grants cannot be sized exactly within a day's XP limits, so
  // these are 0-XP achievement lines inserted together, tagged with this run
  // and removed afterwards; the 100+ line engine moment above is the real one.
  for (const n of [10, 50, 51, 101]) {
    await reset(page);
    const sizes = [];
    await page.route("**/rest/v1/rpc/ams_recognition_claim", async (route) => {
      sizes.push(JSON.parse(route.request().postData() ?? "{}").p_ledger_ids?.length ?? 0);
      return route.continue();
    });
    one(`with ins as (insert into ams_award_ledger (user_id, role, asset_kind, asset_slug, xp_awarded, reason)
           select ${RESELLER}, 'reseller', 'achievement', '${RUN}-size${n}-' || g, 0, '${RUN}:size${n}'
             from generate_series(1, ${n}) g returning 1) select count(*) from ins`);
    await waitFor(async () => (await shown(page)).length > 0, WAIT + 10_000);
    await drain(page, 60_000);
    await page.unroute("**/rest/v1/rpc/ams_recognition_claim");
    const claimedN = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.reason='${RUN}:size${n}'`));
    const expectChunks = Math.ceil(n / 50);
    check(`13 ${String(n).padStart(3)} ids: one presentation, ${expectChunks} claim chunk(s) of at most 50, every id claimed once`,
      (await shown(page)).length === 1 && claimedN === n && sizes.length === expectChunks && Math.max(...sizes) <= 50,
      `shown ${(await shown(page)).length}, claimed ${claimedN}/${n}, chunks ${sizes.join("+")}`);
  }

  /* ---------------------------------------------------------- N: one moment, more than 100 lines */
  // Every remaining daily allowance of three rules, in one evaluation: one
  // moment with more than 100 ledger lines, reaching the legendary stages. One
  // lead.converted is kept back for the rolled-back retry test below.
  const usedToday = (slug) => Number(one(`select count(*) from xp_transactions t join xp_rules r on r.id=t.rule_id join xp_sources s on s.id=r.source_id where t.user_id=${RESELLER} and s.slug='${slug}' and t.created_at >= date_trunc('day', now())`));
  const plan = [
    ["order.paid", 50 - usedToday("order.paid")],
    ["lead.captured", 40 - usedToday("lead.captured")],
    ["lead.converted", 20 - usedToday("lead.converted") - 1],
  ];
  const batch = plan.flatMap(([slug, n]) => Array.from({ length: Math.max(0, n) }, (_, i) =>
    `select ams_ingest_event(${RESELLER}, '${slug}', 'verification', '${RUN}:n-${slug}-${i}', 1, now(), 'verification', '{"ams_role":"reseller"}'::jsonb);`)).join("\n");
  // One tab only, so the measurements below are this tab's.
  await page.close();
  page = await reseller.context.newPage();
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await reset(page);
  // Every peek and claim the page makes is measured, and the second claim
  // chunk is made to fail once: the first chunk must not be lost with it, and
  // the failed one must be retried.
  const peekSizes = [];
  const claimSizes = [];
  let chunkFailed = 0;
  await page.route("**/rest/v1/rpc/ams_recognition_peek", async (route) => {
    peekSizes.push(JSON.parse(route.request().postData() ?? "{}").p_ledger_ids?.length ?? 0);
    return route.continue();
  });
  await page.route("**/rest/v1/rpc/ams_recognition_claim", async (route) => {
    claimSizes.push(JSON.parse(route.request().postData() ?? "{}").p_ledger_ids?.length ?? 0);
    if (FAIL_CHUNK && claimSizes.length === 2 && chunkFailed === 0) {
      chunkFailed += 1;
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"injected chunk failure"}' });
    }
    return route.continue();
  });
  sql(`begin; select set_config('ams.defer_eval', 'on', true);\n${batch}\nselect set_config('ams.defer_eval', 'off', true); select ams_evaluate_user(${RESELLER}); commit;`);
  const nLines = Number(one(`select count(*) from ${linesOf(["n-order.paid-0"])} x`));
  await waitFor(async () => (await shown(page)).length > 0, WAIT + 20_000);
  await drain(page, 90_000);
  const pn = await probe(page);
  const nClaimed = claimedOf(["n-order.paid-0"]);
  await page.unroute("**/rest/v1/rpc/ams_recognition_peek");
  await page.unroute("**/rest/v1/rpc/ams_recognition_claim");
  check("N  the moment has more than 50 ledger lines", nLines > 50, `${nLines} lines`);
  check("N  and more than 100", nLines > 100, `${nLines} lines (${plan.map(([s, n]) => `${s}×${n}`).join(", ")})`);
  check("N  the server is asked in chunks of at most 50, covering every line", Math.max(...peekSizes) <= 50 && peekSizes.reduce((a, b) => a + b, 0) >= nLines && Math.max(...claimSizes) <= 50, `peeks ${peekSizes.join("+")}, claims ${claimSizes.join("+")}`);
  if (FAIL_CHUNK) {
    check("N  a claim chunk failed and was retried", chunkFailed === 1 && claimSizes.length >= 4, `claims ${claimSizes.join("+")}`);
    check("N  the claimed chunks were shown, and the retried chunk followed once", pn.kinds.length === 2 && pn.kinds.some((k) => k.kind === "legendary"), pn.kinds.map((k) => k.kind).join(","));
  } else {
    check("N  it is one presentation, at the legendary tier", pn.kinds.length === 1 && pn.kinds[0].kind === "legendary", pn.kinds.map((k) => k.kind).join(","));
  }
  check("N  every line claimed exactly once, none lost to the 50-id limit", nClaimed === nLines, `${nClaimed}/${nLines}`);
  const dupClaims = Number(one(`select count(*) - count(distinct ledger_id) from ams_recognition_presentations where ledger_id in ${linesOf(["n-order.paid-0"])}`));
  check("N  no line claimed twice", dupClaims === 0);

  /* ---------------------------------------------------------- 9: old history */
  await reset(page);
  // An achievement line, not XP: an XP line would change the role's total the
  // next time the engine sums the ledger.
  one(`insert into ams_award_ledger (user_id, role, asset_kind, asset_slug, xp_awarded, reason, created_at) values (${RESELLER}, 'reseller', 'achievement', '${RUN}-old', 0, '${RUN}:old', now() - interval '25 hours') returning id`);
  await page.waitForTimeout(WAIT);
  const oldNoted = Number(one(`select count(*) from user_notifications n join ams_award_ledger l on n.dedupe_key = 'ams:ledger:' || l.id::text where l.reason='${RUN}:old'`));
  const oldClaimed = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.reason='${RUN}:old'`));
  check("9  a recognition older than a day still reaches the bell", oldNoted === 1);
  check("9  but is not presented as new, and stays unclaimed", (await shown(page)).length === 0 && oldClaimed === 0, `shown ${(await shown(page)).length}, claimed ${oldClaimed}`);
  // Just inside the window: 23 hours 50 minutes old, never shown - still news.
  await reset(page);
  one(`insert into ams_award_ledger (user_id, role, asset_kind, asset_slug, xp_awarded, reason, created_at) values (${RESELLER}, 'reseller', 'achievement', '${RUN}-inside', 0, '${RUN}:inside', now() - interval '23 hours 50 minutes') returning id`);
  await waitFor(async () => (await shown(page)).length > 0, WAIT);
  await drain(page);
  const insideClaimed = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.reason='${RUN}:inside'`));
  check("9  just inside the day, an unseen recognition is still shown, once", (await shown(page)).length === 1 && insideClaimed === 1, `shown ${(await shown(page)).length}, claimed ${insideClaimed}`);
  const oldStill = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.reason='${RUN}:old'`));
  check("9  and the one outside the day stays unshown", oldStill === 0);

  /* ---------------------------------------------------------- provenance of everything shown */
  // Every line this run's screens claimed: the reseller's own, with a role and
  // a kind, and from a real moment - an evaluation that paid XP for one of
  // this run's events through ams_ingest_event. The two lines inserted by hand
  // above to test the window are the only exceptions, and are named.
  const shownRows = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.user_id=${RESELLER} and p.client='browser' and (l.created_at >= ${since} or l.reason like '${RUN}:%')`));
  const unproven = Number(one(`
    select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id
     where l.user_id=${RESELLER} and p.client='browser' and (l.created_at >= ${since} or l.reason like '${RUN}:%')
       and coalesce(l.reason, '') not like '${RUN}:%'
       and not (l.role = 'reseller' and l.asset_kind is not null and exists (
         select 1 from ams_award_ledger x join ams_activity_events e on e.id = x.event_id
          where x.user_id = l.user_id and x.created_at = l.created_at and x.asset_kind = 'xp'
            and e.entity_id like '${RUN}:%' and e.source = 'verification'))`));
  const foreignShown = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where p.user_id <> l.user_id`));
  const handInserted = Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.user_id=${RESELLER} and l.reason like '${RUN}:%'`));
  check("P  every recognition shown traces to a real ledger line, user, role, kind and source event", shownRows > handInserted && unproven === 0, `${shownRows} shown: ${shownRows - handInserted} engine-granted, ${handInserted} run-tagged test lines, ${unproven} without provenance`);
  check("P  no presentation belongs to anyone but the line's owner", foreignShown === 0);

  /* ---------------------------------------------------------- 14b: window edges and repair */
  // Lines inserted by hand to sit at chosen ages. Achievement lines, 0 XP, so
  // no role's XP total moves. Each is tagged with this run for cleanup.
  const aged = (tag, age) => one(`insert into ams_award_ledger (user_id, role, asset_kind, asset_slug, xp_awarded, reason, created_at) values (${RESELLER}, 'reseller', 'achievement', '${RUN}-${tag}', 0, '${RUN}:${tag}', now() - interval '${age}') returning id`);
  const shownOf = (tag) => Number(one(`select count(*) from ams_recognition_presentations p join ams_award_ledger l on l.id=p.ledger_id where l.reason='${RUN}:${tag}'`));
  await reset(page);
  aged("edge-2359", "23 hours 59 minutes");
  await waitFor(async () => (await shown(page)).length > 0, WAIT);
  await drain(page);
  check("14 23h59m old and unseen: shown once", (await shown(page)).length === 1 && shownOf("edge-2359") === 1, `shown ${(await shown(page)).length}`);
  await reset(page);
  aged("edge-2401", "24 hours 1 minute");
  aged("edge-3d", "3 days");
  await page.waitForTimeout(WAIT);
  check("14 24h01m and 3 days old: never presented as new", (await shown(page)).length === 0 && shownOf("edge-2401") === 0 && shownOf("edge-3d") === 0);

  // Repair: with no tab open, a notification is lost; the sweep's repair writes
  // it again. When a tab opens, the recent recognition is shown once and the
  // old one never - it only reaches the bell.
  await page.close();
  const recentId = aged("repair-new", "5 minutes");
  const oldId = aged("repair-old", "3 days");
  one(`delete from user_notifications where dedupe_key in ('ams:ledger:${recentId}','ams:ledger:${oldId}') returning 1`);
  const repaired1 = Number(one(`select ams_recognition_repair()`));
  const repaired2 = Number(one(`select ams_recognition_repair()`));
  const noteRows = Number(one(`select count(*) from user_notifications where dedupe_key in ('ams:ledger:${recentId}','ams:ledger:${oldId}')`));
  check("15 the repair writes each missing notification exactly once", repaired1 >= 2 && repaired2 === 0 && noteRows === 2, `first ${repaired1}, second ${repaired2}, rows ${noteRows}`);
  page = await reseller.context.newPage();
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await waitFor(async () => (await shown(page)).length > 0, WAIT);
  await drain(page);
  await page.waitForTimeout(3000);
  check("15 the repaired recent recognition is shown once", shownOf("repair-new") === 1 && (await shown(page)).length === 1, `shown ${(await shown(page)).length}`);
  check("15 the repaired old one stays history", shownOf("repair-old") === 0);

  /* ---------------------------------------------------------- 24b: revoked and malformed certificates */
  const revokedNo = one(`select certificate_no from ams_certificates where user_id=${RESELLER} order by stage limit 1`);
  one(`update ams_certificates set revoked_at = now(), revoked_reason = 'verification run ${RUN}' where certificate_no = '${revokedNo}' returning 1`);
  await page.goto(`${BASE}/verify/${revokedNo}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const revokedText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("24 a revoked certificate verifies as revoked", (await page.locator("[data-certificate-verify]").getAttribute("data-certificate-verify")) === "invalid" && /revoked/i.test(revokedText), revokedText.slice(0, 80));
  one(`update ams_certificates set revoked_at = null, revoked_reason = null where certificate_no = '${revokedNo}' returning 1`);
  await page.goto(`${BASE}/verify/${encodeURIComponent("SV-CRT-%27;drop--")}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  check("24 a malformed number is simply not recognised", (await page.locator("[data-certificate-verify]").getAttribute("data-certificate-verify")) === "invalid");
  const pub = await fetch(`${process.env.SV_API_BASE ?? ops.SV_API_BASE ?? "https://softwarevala.net"}/rest/v1/rpc/ams_verify_certificate`, {
    method: "POST", headers: { apikey: ops.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_certificate_no: revokedNo }),
  }).then((r) => r.json());
  check("24 public verification names no holder", pub.valid === true && !("user_id" in pub) && !JSON.stringify(pub).includes(one(`select id from auth.users where email='test.reseller@softwarevala.test'`)), Object.keys(pub).join(","));
  await page.goto(`${BASE}/dashboard/reseller`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  /* ---------------------------------------------------------- 26: every AMS role, isolated (rolled back) */
  // The reseller account briefly holds every platform role that maps to an AMS
  // role, and one real event is sent under each AMS role. Everything is rolled
  // back. Creator has no platform role that maps to it, so no account can hold
  // it; it is reported, not faked.
  const ROLE_EVENTS = [
    ["user", "customer", "order.paid"], ["reseller", "reseller", "lead.converted"],
    ["franchise", "franchise", "order.paid"], ["author", "author", "seo.published"],
    ["vendor", "vendor", "product.published"], ["affiliate", "affiliate", "lead.captured"],
    ["influencer", "influencer", "campaign.delivered"], ["developer", "developer", "task.completed"],
    ["seo", "seo", "seo.published"], ["support", "support", "support.resolved"],
  ];
  const allRoles = sql(`
    begin;
    insert into user_roles (user_id, role)
      select ${RESELLER}, r::app_role from unnest(array[${ROLE_EVENTS.map(([, p]) => `'${p}'`).join(",")}]) r
      where not exists (select 1 from user_roles x where x.user_id=${RESELLER} and x.role::text = r);
    ${ROLE_EVENTS.map(([ams, , key], i) => `select 'ingest_${ams}', ams_ingest_event(${RESELLER}, '${key}', 'verification', '${RUN}:r${i}', 1, now(), 'verification', '{"ams_role":"${ams}"}'::jsonb)->>'ok';`).join("\n    ")}
    ${["manager", "administrator", "founder", "operator"].map((r) => `select 'refused_${r}', coalesce(ams_ingest_event(${RESELLER}, 'order.paid', 'verification', '${RUN}:x-${r}', 1, now(), 'verification', '{"ams_role":"${r}"}'::jsonb)->>'reason', 'accepted');`).join("\n    ")}
    select 'roles_with_lines', count(distinct role) from ams_award_ledger where user_id=${RESELLER} and created_at = now();
    select 'foreign_slugs', count(*) from ams_award_ledger where user_id=${RESELLER} and created_at = now()
       and asset_kind in ('stage','achievement','badge','trophy','award') and split_part(asset_slug, '-', 1) <> role;
    select 'foreign_codes', count(*) from ams_award_ledger where user_id=${RESELLER} and created_at = now()
       and asset_kind in ('certificate','passport') and asset_slug not like '%-' || upper(substr(role, 1, 3)) || '%';
    select 'passports', count(distinct passport_no) from ams_passports where user_id=${RESELLER};
    select 'xp_rows', count(*) from user_xp where user_id=${RESELLER};
    select 'note_role_mismatch', count(*) from user_notifications n join ams_award_ledger l on n.dedupe_key = 'ams:ledger:' || l.id::text
       where l.user_id=${RESELLER} and l.created_at = now() and n.data->>'role' <> l.role;
    select 'xp_from_other_roles_rules', count(*) from xp_transactions t join xp_rules r on r.id = t.rule_id
       where t.user_id=${RESELLER} and t.created_at = now() and r.conditions->>'role' is not null and r.conditions->>'role' <> t.role;
    rollback;`);
  const rv = (k) => (allRoles.find((l) => l.startsWith(`${k} `)) ?? "").split("|").pop().trim();
  const rolesAccepted = ROLE_EVENTS.filter(([ams]) => rv(`ingest_${ams}`) === "true").map(([ams]) => ams);
  check("26 ten AMS roles each accept a real event for the same person", rolesAccepted.length === 10, rolesAccepted.join(","));
  check("26 each of them has its own recognitions", Number(rv("roles_with_lines")) === 10, `${rv("roles_with_lines")} roles with lines`);
  check("26 no recognition carries another role's catalogue", Number(rv("foreign_slugs")) === 0 && Number(rv("foreign_codes")) === 0, `slugs ${rv("foreign_slugs")}, codes ${rv("foreign_codes")}`);
  check("26 each role has its own passport and its own XP", Number(rv("passports")) === 10 && Number(rv("xp_rows")) === 10, `passports ${rv("passports")}, xp rows ${rv("xp_rows")}`);
  check("26 every notification names the role of its own line", Number(rv("note_role_mismatch")) === 0);
  check("26 no XP paid under another role's rule", Number(rv("xp_from_other_roles_rules")) === 0);
  const nonAms = ["manager", "administrator", "founder", "operator"].map((r) => rv(`refused_${r}`));
  check("26 Manager, Administrator, Founder and Operator are refused", nonAms.every((x) => x === "role_not_held" || x === "no_ams_role"), nonAms.join(","));
  const creatorHoldable = one(`select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='app_role' and public.ams_role_of(e.enumlabel) = 'creator'`);
  console.log(`  NOTE  creator: ${creatorHoldable} platform role maps to it - no account can earn Creator recognition yet`);

  /* ---------------------------------------------------------- 11: listener identity */
  check("7  the stream answers 200 as text/event-stream for the signed-in user", mode === 200 && /^text\/event-stream/.test(streamType), `${mode} ${streamType}`);
  if (mode === 200) {
    const log = readFileSync(`${process.env.TEMP}/sv-3203.log`, "utf8");
    check("11 the live listener runs on sv_platform", /\[notification-hub\] listening: current_database=sv_platform/.test(log) && !/current_database=softwarevala/.test(log), (log.match(/\[notification-hub\][^\n]*/) ?? ["no line"])[0]);
  }

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
  const foreignOwner = one("select id from auth.users where email='test.author@softwarevala.test'");
  const forged = await page.evaluate(async ({ t, foreignId, foreignOwner, run, base, key }) => {
    const h = { Authorization: `Bearer ${t}`, "Content-Type": "application/json", apikey: key };
    const uid = JSON.parse(atob(t.split(".")[1])).sub;
    const ins = await fetch(`${base}/rest/v1/user_notifications`, {
      method: "POST", headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: uid, type: "success", message: "Trophy earned: forged", event_type: "ams.recognition.trophy", dedupe_key: `${run}:forged`, data: { ledger_id: foreignId } }),
    });
    const claim = await fetch(`${base}/rest/v1/rpc/ams_recognition_claim`, { method: "POST", headers: h, body: JSON.stringify({ p_ledger_ids: [foreignId] }) });
    const peekRpc = await fetch(`${base}/rest/v1/rpc/ams_recognition_peek`, { method: "POST", headers: h, body: JSON.stringify({ p_ledger_ids: [foreignId] }) });
    const history = await fetch(`${base}/rest/v1/rpc/ams_recognitions`, { method: "POST", headers: h, body: JSON.stringify({ p_role: "author", p_user_id: foreignOwner, p_limit: 10 }) });
    const peek = await fetch(`${base}/rest/v1/ams_recognition_presentations?select=ledger_id&ledger_id=eq.${foreignId}`, { headers: h });
    return { inserted: ins.status, claim: await claim.json(), read: await peekRpc.json(), history: await history.json(), peek: await peek.json() };
  }, { t: token, foreignId: foreign, foreignOwner, run: RUN, base: process.env.SV_API_BASE ?? ops.SV_API_BASE ?? "https://softwarevala.net", key: ops.SUPABASE_PUBLISHABLE_KEY });
  check("18 a user cannot claim someone else's recognition", Array.isArray(forged.claim?.claimed) && forged.claim.claimed.length === 0, JSON.stringify(forged.claim).slice(0, 80));
  check("18 nor read it before it is shown", Array.isArray(forged.read?.recognitions) && forged.read.recognitions.length === 0, JSON.stringify(forged.read).slice(0, 80));
  check("18 nor read their history", forged.history?.reason === "not_permitted", JSON.stringify(forged.history).slice(0, 80));
  check("18 nor read whether it was shown", Array.isArray(forged.peek) && forged.peek.length === 0, JSON.stringify(forged.peek).slice(0, 60));
  await page.waitForTimeout(WAIT);
  check("18 a notification the user wrote themselves shows nothing", (await shown(page)).length === 0, `insert ${forged.inserted}`);
  check("no page error for the reseller", reseller.errors.length === 0, reseller.errors.slice(0, 2).join(" | "));
  await reseller.context.close();
  await bystander.context.close();

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
    select 'failing_lines', count(*) from ams_award_ledger l where l.user_id=${RESELLER} and l.role='reseller' and l.created_at = now();
    select 'failing_notes', count(*) from user_notifications where user_id=${RESELLER} and created_at = now() and data->>'role'='reseller' and event_type like 'ams.recognition.%';
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
  if (error?.cleanupOnly) console.log(`  cleaning up ${RUN}`);
  else {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 400) : error}`);
  }
} finally {
  if (cleanupNeeded) {
    // Everything this run created for the test account, and nothing else.
    const out = sql(`
      begin;
      create temp table run_users as select ${RESELLER} as id;
      create temp table run_lines as
        select l.id from ams_award_ledger l, run_users u
         where l.user_id = u.id and (l.created_at >= ${since} or l.reason like '${RUN}:%');
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
        + (select count(*) from user_notifications where dedupe_key like '${RUN}:%')
        + (select count(*) from ams_award_ledger where reason = '${RUN}:old')
        + (select count(*) from ams_award_ledger l, run_users u where l.user_id = u.id)
        + (select count(*) from user_notifications n, run_users u where n.user_id = u.id and n.event_type like 'ams.%');
      commit;`);
    const left = (out.find((l) => l.startsWith("left ")) ?? "").split("|").pop().trim();
    check("the run's rows were removed", left === "0", `left ${left}`);
    const triggers = one("select string_agg(tgname || '=' || tgenabled::text, ',') from pg_trigger where tgname in ('ams_ledger_no_rewrite','ams_events_no_rewrite')");
    check("the append-only guards are back on", !/=D/.test(triggers), triggers);
  }
  await browser.close();
}

console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
