/**
 * Reseller data security over HTTP, as real signed-in people, read-only apart
 * from write attempts that must be refused (each one is checked against the
 * database afterwards to prove nothing changed).
 *
 *   node scripts/ops/reseller-api-security-verify.mjs [base]
 *
 * Identities: anonymous (publishable key only), reseller A (the reseller test
 * account), another signed-in user who is not a reseller (the affiliate test
 * account), and an admin. Every request goes to {base}/rest/v1 - the same
 * PostgREST the browser uses - or to the app's own /api routes.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const env = {};
for (const f of ["sv-public.env"]) for (const l of readFileSync(`${process.env.TEMP}/${f}`, "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3010";
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(70)} ${detail}`); };
const db = (sql) => execFileSync("node", ["scripts/ops/db.mjs", "--sql", `set default_transaction_read_only=on; copy (${sql}) to stdout`], { encoding: "utf8" })
  .split("\n").filter((l) => l && !/^(target|SET)/.test(l) && !/^\s*$/.test(l));

async function signIn(login) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: ops[`SV_LOGIN_${login}`], password: ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`sign-in ${login} failed: ${r.status}`);
  return { token: j.access_token, uid: j.user.id };
}
const rest = (who, path, init = {}) => fetch(`${BASE}/rest/v1/${path}`, {
  ...init, headers: { apikey: KEY, ...(who ? { authorization: `Bearer ${who.token}` } : {}), "content-type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
});
const rows = async (who, table) => { const r = await rest(who, `${table}?select=*&limit=1000`); return { status: r.status, body: r.ok ? await r.json() : await r.text() }; };

const anon = null;
const A = await signIn("RESELLER");
const other = await signIn("AFFILIATE");
const admin = await signIn("ADMIN");
const [ra] = db(`select id from resellers where user_id = '${A.uid}'`);
const [rb] = db(`select id from resellers where code = 'RLSTEST-9e40fc-B'`);
console.log(`  ..    reseller A ${ra}, reseller B ${rb}`);

// ---------------------------------------------------------------- reads
const OWN = {
  resellers: (r) => r.id === ra,
  reseller_commissions: (r) => r.reseller_id === ra, reseller_payouts: (r) => r.reseller_id === ra,
  reseller_memberships: (r) => r.reseller_id === ra, reseller_membership_orders: (r) => r.reseller_id === ra,
  reseller_membership_events: (r) => r.reseller_id === ra, reseller_notifications: (r) => r.reseller_id === ra,
  reseller_payout_schedules: (r) => r.reseller_id === ra, reseller_commission_rules: (r) => r.reseller_id === ra || r.reseller_id === null,
  marketplace_referral_codes: (r) => r.reseller_id === ra, marketplace_referral_sessions: (r) => r.reseller_id === ra,
  marketplace_order_attributions: (r) => r.reseller_id === ra,
  marketplace_orders: (r) => r.buyer_id === A.uid,
  user_notifications: (r) => r.user_id === A.uid, notifications: (r) => r.user_id === A.uid,
  ams_passports: (r) => r.user_id === A.uid, crm_customers: (r) => r.owner_id === A.uid, crm_tasks: (r) => r.owner_id === A.uid,
  team_members: (r) => r.user_id === A.uid,
  reward_wallets: (r) => r.user_id === A.uid,
};
const ORDER_CHILD = ["marketplace_order_items", "marketplace_order_refunds", "marketplace_order_status_history"];
const NOBODY = ["marketplace_commission_reversals", "partner_commissions", "finance_wallets", "finance_wallet_transactions", "finance_payouts", "finance_commissions", "marketplace_payouts", "partner_payouts"];
const PRIVATE = [...Object.keys(OWN), ...ORDER_CHILD, ...NOBODY, "chat_messages", "chat_participants", "chat_conversations"];

const aOrders = new Set((await rows(A, "marketplace_orders")).body.map?.((o) => o.id) ?? []);
for (const t of Object.keys(OWN)) {
  const { status, body } = await rows(A, t);
  if (!Array.isArray(body)) { check(`A reads ${t}`, status === 401 || status === 403 || status === 404, `HTTP ${status}`); continue; }
  const foreign = body.filter((r) => !OWN[t](r));
  check(`A sees only its own ${t}`, foreign.length === 0, `${body.length} visible, ${foreign.length} of others`);
}
for (const t of ORDER_CHILD) {
  const { status, body } = await rows(A, t);
  const foreign = Array.isArray(body) ? body.filter((r) => !aOrders.has(r.order_id)) : [];
  check(`A sees only its own ${t}`, foreign.length === 0, Array.isArray(body) ? `${body.length} visible, ${foreign.length} of others` : `HTTP ${status}`);
}
for (const t of NOBODY) {
  const { status, body } = await rows(A, t);
  check(`A sees no ${t} (finance/partner ledgers)`, !Array.isArray(body) || body.length === 0, Array.isArray(body) ? `${body.length} visible` : `HTTP ${status}`);
}
{
  const conv = new Set(db(`select conversation_id from chat_participants where user_id = '${A.uid}'`));
  for (const t of ["chat_participants", "chat_messages", "chat_conversations"]) {
    const { status, body } = await rows(A, t);
    const key = t === "chat_conversations" ? "id" : "conversation_id";
    const foreign = Array.isArray(body) ? body.filter((r) => !conv.has(r[key])) : [];
    check(`A sees only conversations it is in (${t})`, foreign.length === 0, Array.isArray(body) ? `${body.length} visible, ${foreign.length} outside` : `HTTP ${status}`);
  }
}
for (const t of PRIVATE) {
  const { status, body } = await rows(anon, t);
  check(`anonymous sees no ${t}`, !Array.isArray(body) || body.length === 0, Array.isArray(body) ? `${body.length} rows` : `HTTP ${status}`);
}
for (const t of ["resellers", "reseller_commissions", "reseller_payouts", "reseller_memberships", "reseller_membership_orders", "marketplace_order_attributions", "marketplace_referral_codes"]) {
  const { body } = await rows(other, t);
  const seen = Array.isArray(body) ? body.filter((r) => r.reseller_id === ra || r.id === ra).length : 0;
  check(`a signed-in non-reseller sees none of A's ${t}`, seen === 0, `${seen} of A's rows`);
}
{
  const { body } = await rows(admin, "resellers");
  check("admin sees every reseller (operators are not locked out)", Array.isArray(body) && body.length === Number(db("select count(*) from resellers")[0]), `${Array.isArray(body) ? body.length : body}`);
}

// ---------------------------------------------------------------- IDOR and forged writes
const snap = () => db(`select concat_ws('|', (select status||'/'||coalesce(plan_code,'') from resellers where id = '${ra}'), (select status from resellers where id = '${rb}'), (select count(*) from reseller_commissions), (select count(*) from reseller_payouts), (select coalesce(string_agg(id||status, ',' order by id), '') from reseller_payouts), (select count(*) from marketplace_order_attributions))`)[0];
const before = snap();
{
  const r = await rest(A, `resellers?id=eq.${rb}&select=id`); const b = await r.json();
  check("A reading B by id (IDOR) returns nothing", Array.isArray(b) && b.length === 0, `HTTP ${r.status}, ${b.length} rows`);
  const u = await rest(A, `resellers?id=eq.${rb}`, { method: "PATCH", body: JSON.stringify({ status: "terminated" }) }); const ub = await u.json().catch(() => null);
  check("A changing B's status touches no row", !Array.isArray(ub) || ub.length === 0, `HTTP ${u.status}`);
  const s = await rest(A, `resellers?id=eq.${ra}`, { method: "PATCH", body: JSON.stringify({ plan_code: "master_reseller" }) });
  check("A upgrading its own plan is refused", !s.ok, `HTTP ${s.status}`);
  const st = await rest(A, `resellers?id=eq.${ra}`, { method: "PATCH", body: JSON.stringify({ status: "active", user_id: other.uid }) });
  check("A handing its reseller record to another user is refused", !st.ok, `HTTP ${st.status}`);
  const pb = db(`select id from reseller_payouts where reseller_id <> '${ra}' limit 1`)[0];
  if (pb) { const p = await rest(A, `reseller_payouts?id=eq.${pb}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) }); const pj = await p.json().catch(() => null); check("A marking another reseller's payout paid touches no row", !Array.isArray(pj) || pj.length === 0, `HTTP ${p.status}`); }
  const [oid, iid] = (db(`select i.order_id||' '||i.id from marketplace_order_items i join marketplace_orders o on o.id=i.order_id where o.status='paid' limit 1`)[0] ?? " ").split(" ");
  const fc = await rest(A, "reseller_commissions", { method: "POST", body: JSON.stringify({ reseller_id: ra, order_id: oid, order_item_id: iid, gross_amount: 1, commission_amount: 1000, currency: "USD", status: "available", rule_snapshot: {}, idempotency_key: `forge-${Date.now()}` }) });
  check("A forging a commission for itself is refused", !fc.ok, `HTTP ${fc.status}`);
  const fp = await rest(A, "reseller_payouts", { method: "POST", body: JSON.stringify({ reseller_id: ra, amount: 1000, currency: "USD", status: "paid", idempotency_key: `forge-${Date.now()}` }) });
  check("A forging a paid payout is refused", !fp.ok, `HTTP ${fp.status}`);
  const fa = await rest(A, "marketplace_order_attributions", { method: "POST", body: JSON.stringify({ order_id: oid, reseller_id: ra }) });
  check("A attributing someone else's order to itself is refused", !fa.ok, `HTTP ${fa.status}`);
  const fb = await rest(A, "reseller_commissions", { method: "POST", body: JSON.stringify({ reseller_id: rb, order_id: oid, order_item_id: iid, gross_amount: 1, commission_amount: 1, currency: "USD", status: "available", rule_snapshot: {}, idempotency_key: `forge-b-${Date.now()}` }) });
  check("A writing a commission in B's name is refused", !fb.ok, `HTTP ${fb.status}`);
}
for (const [who, label] of [[A, "reseller A"], [other, "a non-reseller"], [anon, "anonymous"]]) {
  const call = async (fn, args) => { const r = await rest(who, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, reason: (() => { try { return JSON.parse(t).reason ?? JSON.parse(t).code; } catch { return t.slice(0, 40); } })() }; };
  const pid = db("select id from reseller_payouts limit 1")[0] ?? "00000000-0000-0000-0000-000000000000";
  for (const [fn, args] of [["mm_reseller_payout_status", { p_payout: pid, p_to: "approved" }], ["mm_reseller_payout_create", { p_id: rb, p_reason: "x" }], ["mm_reseller_status", { p_id: rb, p_to: "terminated", p_reason: "x" }], ["reseller_rate_for", { p_reseller: ra, p_product: null, p_category: null }]]) {
    const res = await call(fn, args);
    const refused = res.reason === "not_permitted" || res.status === 401 || res.status === 403 || res.status === 404 || res.reason === "42501" || (fn === "reseller_rate_for" && res.reason === "PGRST202");
    check(`${label} cannot run operator function ${fn}`, refused, `HTTP ${res.status} ${res.reason}`);
  }
}
// ---------------------------------------------------------------- notifications and AMS
{
  const call = async (who, fn, args) => { const r = await rest(who, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const foreign = db(`select id || ' ' || is_read || ' ' || coalesce(is_dismissed, false) from user_notifications where user_id <> '${A.uid}' and not coalesce(is_dismissed, false) and not is_read order by created_at desc limit 1`)[0];
  if (foreign) {
    const [nid, , ] = foreign.split(" ");
    const r = await call(A, "mm_notification_read", { p_id: nid, p_dismiss: true });
    const nowState = db(`select id || ' ' || is_read || ' ' || coalesce(is_dismissed, false) from user_notifications where id = '${nid}'`)[0];
    check("A cannot mark or dismiss another person's notification", nowState === foreign, `HTTP ${r.status}, row ${nowState === foreign ? "unchanged" : "CHANGED"}`);
  } else console.log("  ..    no unread notification of another person to try");
  const mine = await call(A, "mm_notifications", { p_limit: 200 });
  const list = Array.isArray(mine.body) ? mine.body : (mine.body?.items ?? mine.body?.notifications ?? []);
  const ids = list.map((n) => n.id).filter(Boolean);
  const owners = ids.length ? db(`select distinct user_id from user_notifications where id in (${ids.map((i) => `'${i}'`).join(",")})`) : [];
  check("the notification bell lists only A's own notifications", owners.every((o) => o === A.uid), `${ids.length} listed, owners ${owners.length ? owners.map((o) => (o === A.uid ? "A" : "OTHER")).join(",") : "-"}`);
  const anonList = await call(null, "mm_notifications", { p_limit: 50 });
  const anonItems = Array.isArray(anonList.body) ? anonList.body : (anonList.body?.items ?? anonList.body?.notifications ?? []);
  check("anonymous gets no notifications from the bell", !anonItems.length, `HTTP ${anonList.status}`);
  const otherLedger = db(`select id from ams_award_ledger where user_id <> '${A.uid}' order by created_at desc limit 3`);
  if (otherLedger.length) {
    const before = db(`select string_agg(id || coalesce(claimed_at::text, '-'), ',' order by id) from ams_award_ledger where id in (${otherLedger.map((i) => `'${i}'`).join(",")})`)[0];
    const peek = await call(A, "ams_recognition_peek", { p_ledger_ids: otherLedger });
    const claim = await call(A, "ams_recognition_claim", { p_ledger_ids: otherLedger });
    const after = db(`select string_agg(id || coalesce(claimed_at::text, '-'), ',' order by id) from ams_award_ledger where id in (${otherLedger.map((i) => `'${i}'`).join(",")})`)[0];
    const peekText = JSON.stringify(peek.body ?? "");
    check("A cannot see or claim another person's AMS recognition", before === after && !otherLedger.some((i) => peekText.includes(i)), `peek HTTP ${peek.status}, claim HTTP ${claim.status}, ledger ${before === after ? "unchanged" : "CHANGED"}`);
  }
  const chain = await call(A, "ams_role_chain", { p_role: "reseller", p_user_id: other.uid });
  console.log(`  ..    ams_role_chain for another user, as A: HTTP ${chain.status} ${JSON.stringify(chain.body).slice(0, 160)}`);
}

const after = snap();
check("the database is unchanged after every refused write", before === after, before === after ? "" : `${before} -> ${after}`);

// ---------------------------------------------------------------- the app's own routes
{
  const get = (who, p) => fetch(`${BASE}${p}`, { headers: who ? { authorization: `Bearer ${who.token}` } : {} });
  let r = await get(anon, "/api/reseller/referral"); check("anonymous: /api/reseller/referral is refused", r.status === 401, `HTTP ${r.status}`);
  r = await get(other, "/api/reseller/referral"); check("a non-reseller: /api/reseller/referral is refused", r.status === 403, `HTTP ${r.status}`);
  r = await get(A, "/api/reseller/referral"); const rj = await r.json().catch(() => ({}));
  const codes = JSON.stringify(rj); const dbCodes = db(`select code from marketplace_referral_codes where reseller_id = '${ra}'`);
  check("reseller A: /api/reseller/referral returns only its own links", r.ok && dbCodes.every((c) => codes.includes(c)) && !db(`select code from marketplace_referral_codes where reseller_id is distinct from '${ra}'`).some((c) => codes.includes(c)), `HTTP ${r.status}, ${dbCodes.length} links in database`);
  for (const res of ["resellers", "reseller_payouts", "reseller_commissions"]) {
    r = await get(A, `/api/manager/resource?resource=${res}`); check(`reseller A cannot open the manager resource ${res}`, r.status === 401 || r.status === 403, `HTTP ${r.status}`);
    r = await get(anon, `/api/manager/resource?resource=${res}`); check(`anonymous cannot open the manager resource ${res}`, r.status === 401 || r.status === 403, `HTTP ${r.status}`);
  }
}

console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
