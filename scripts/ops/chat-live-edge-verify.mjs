/**
 * Live chat edge cases, real accounts, real database, against a running build.
 *
 *   node scripts/ops/chat-live-edge-verify.mjs [base]
 *
 * Two people in browsers of their own (author and vendor), plus a late joiner
 * (affiliate). Covers: a message sent before the other side has the
 * conversation open, two tabs of one person, ten rapid messages (order and no
 * duplicates), offline -> online catch-up, refresh, a late joiner, and no
 * leakage into a second group. Test conversations are removed afterwards.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2"); }
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(70)} ${detail}`); };
function sql(q) {
  const r = spawnSync("node", ["scripts/ops/db.mjs", "--sql", q], { encoding: "utf8" });
  if (/\b(ERROR|FATAL):/.test(`${r.stdout}${r.stderr}`)) throw new Error(`${r.stderr}${r.stdout}`.slice(0, 400));
  return r.stdout.split("\n").map((l) => l.trim()).filter((l) => l && !/^target|^-+$|rows?\)$|^SET$|^BEGIN$|^COMMIT$|^INSERT|^ALTER|^DELETE|^UPDATE/.test(l));
}
const one = (q) => sql(q)[1] ?? "";
const id = (login) => one(`select id from auth.users where email='${ops[`SV_LOGIN_${login}`]}'`);
const A = id("AUTHOR"), V = id("VENDOR"), L = id("AFFILIATE");
const RUN = `edge-${Date.now()}`;
const G1 = randomUUID(), G2 = randomUUID();
const S1 = `Edge one ${RUN}`, S2 = `Edge two ${RUN}`;
const before = one(`select (select count(*) from conversations)||'/'||(select count(*) from messages)`);
sql(`begin;
  insert into conversations (id, subject, kind, created_by) values ('${G1}', '${S1}', 'group', '${A}'), ('${G2}', '${S2}', 'group', '${A}');
  insert into conversation_participants (conversation_id, user_id) values ('${G1}', '${A}'), ('${G1}', '${V}'), ('${G2}', '${A}');
  commit;`);

const browsers = [];
async function signIn(login) {
  const browser = await chromium.launch(); browsers.push(browser);
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`); await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]); await page.fill('input[type="password"]', ops.SV_PW_TEST);
  await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  return { browser, context, page };
}
async function open(page, subject) {
  if (!page.url().endsWith("/chat")) { await page.goto(`${BASE}/chat`); }
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: new RegExp(subject) }).first().click({ timeout: 20000 });
  await page.waitForTimeout(1500);
}
async function say(page, text) { const c = page.getByPlaceholder(/Type a message/); await c.click(); await c.fill(text); await c.press("Enter"); }
const sees = (page, text, ms = 15000) => page.getByText(text, { exact: false }).first().waitFor({ timeout: ms }).then(() => true).catch(() => false);
// Counted among rendered messages only: the conversation list repeats the
// latest message as its preview.
const count = (page, text) => page.locator("[data-message-id]").filter({ hasText: text }).count();

try {
  const author = await signIn("AUTHOR");
  // 1. A message sent before the other side has the conversation open.
  await open(author.page, S1);
  await say(author.page, `early ${RUN}`);
  await author.page.waitForTimeout(1500);
  const vendor = await signIn("VENDOR");
  await open(vendor.page, S1);
  check("a message sent before the other side opened the chat is there on arrival", await sees(vendor.page, `early ${RUN}`));

  // 2. Live both ways.
  await say(vendor.page, `vendor live ${RUN}`);
  check("live: author sees the vendor's message without reload", await sees(author.page, `vendor live ${RUN}`));

  // 3. Two tabs of one person both receive.
  const tab2 = await vendor.context.newPage();
  await tab2.goto(`${BASE}/chat`); await open(tab2, S1);
  await say(author.page, `two tabs ${RUN}`);
  const t1 = await sees(vendor.page, `two tabs ${RUN}`), t2 = await sees(tab2, `two tabs ${RUN}`);
  check("two tabs of one person both receive live", t1 && t2, `tab1 ${t1}, tab2 ${t2}`);
  await tab2.close();

  // 4. Ten rapid messages: all arrive, once, in order.
  const typed = Date.now();
  for (let i = 1; i <= 10; i++) await say(author.page, `rapid ${i} ${RUN}`);
  // Sends are queued one after another, so the last arrives after all ten
  // round trips; through a local server and an ssh tunnel that is slower
  // than on the live site, so the time is reported rather than assumed.
  const all = await sees(vendor.page, `rapid 10 ${RUN}`, 90000);
  const tookMs = Date.now() - typed;
  await vendor.page.waitForTimeout(1500);
  const text = await vendor.page.evaluate(() => [...document.querySelectorAll("[data-message-id]")].map((e) => e.textContent).join(" | "));
  const positions = Array.from({ length: 10 }, (_, k) => text.indexOf(`rapid ${k + 1} ${RUN}`));
  const ordered = positions.every((p, k) => p >= 0 && (k === 0 || p > positions[k - 1]));
  const dupes = await Promise.all(Array.from({ length: 10 }, (_, k) => count(vendor.page, `rapid ${k + 1} ${RUN}`)));
  check("ten rapid messages arrive live, in order, once each", all && ordered && dupes.every((n) => n === 1), `ordered ${ordered}, counts ${dupes.join("")}, last arrived after ${tookMs} ms`);
  check("the database holds each rapid message once", one(`select count(*) from messages where conversation_id='${G1}' and body like 'rapid % ${RUN}'`) === "10");

  // 5. Offline -> online catch-up.
  await vendor.context.setOffline(true);
  await say(author.page, `while offline ${RUN}`);
  await author.page.waitForTimeout(2000);
  await vendor.context.setOffline(false);
  check("offline -> online: the missed message arrives without reload", await sees(vendor.page, `while offline ${RUN}`, 30000));

  // 6. Refresh keeps history and stays live.
  await vendor.page.reload(); await open(vendor.page, S1);
  const history = await sees(vendor.page, `early ${RUN}`);
  await say(author.page, `after refresh ${RUN}`);
  check("refresh: history is there and live delivery continues", history && (await sees(vendor.page, `after refresh ${RUN}`)));

  // 7. A late joiner sees the history and then live messages.
  sql(`insert into conversation_participants (conversation_id, user_id) values ('${G1}', '${L}')`);
  const late = await signIn("AFFILIATE");
  await open(late.page, S1);
  const lateHistory = await sees(late.page, `early ${RUN}`);
  await say(author.page, `for the late joiner ${RUN}`);
  check("late joiner: sees the history, then receives live", lateHistory && (await sees(late.page, `for the late joiner ${RUN}`)));

  // 8. No leakage: a message in a group the vendor is not in never reaches them.
  await open(author.page, S2);
  await say(author.page, `private ${RUN}`);
  await vendor.page.waitForTimeout(5000);
  check("no leakage: a message in another group never reaches a non-member", (await count(vendor.page, `private ${RUN}`)) === 0 && !(await vendor.page.evaluate((s) => document.body.innerText.includes(s), S2)));
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 600) : error}`);
} finally {
  for (const b of browsers) await b.close().catch(() => {});
  sql(`begin;
    alter table messages disable trigger messages_immutable_delete;
    delete from message_receipts where message_id in (select id from messages where conversation_id in ('${G1}','${G2}'));
    delete from message_reactions where message_id in (select id from messages where conversation_id in ('${G1}','${G2}'));
    delete from message_mentions where message_id in (select id from messages where conversation_id in ('${G1}','${G2}'));
    delete from messages where conversation_id in ('${G1}','${G2}');
    alter table messages enable trigger messages_immutable_delete;
    delete from chat_handoffs where conversation_id in ('${G1}','${G2}');
    delete from conversation_participants where conversation_id in ('${G1}','${G2}');
    delete from conversations where id in ('${G1}','${G2}');
    commit;`);
  const after = one(`select (select count(*) from conversations)||'/'||(select count(*) from messages)`);
  check("test conversations removed; counts as before", after === before, `${before} -> ${after}`);
  check("message immutability guard back on", one(`select tgenabled::text from pg_trigger where tgname='messages_immutable_delete'`) === "O");
}
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
