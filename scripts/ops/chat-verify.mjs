/**
 * Connect Chat and Chat Manager, end to end, on the real database.
 *
 *   node scripts/ops/chat-verify.mjs [base]
 *
 * - The chat button: in every kind of top bar, only for a role Chat Manager
 *   lets send messages, and never for a visitor.
 * - Chat Manager: opens for its operator and reads the real chat tables.
 * - Live chat: a message sent by one person reaches the other's open chat
 *   without a reload, over the platform's notification stream, and nobody
 *   else's stream.
 * - The rules: messages cannot be edited or deleted, copying is blocked on the
 *   chat surface, a manager may read a conversation an outsider may not.
 * - Control: withdrawing message.send from a role (what Chat Manager's Role
 *   Access Matrix does) removes the button for that role; restoring it brings
 *   it back.
 * Writes only on the test accounts; everything is removed or restored after.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const ops = {};
for (const l of readFileSync(".env.ops", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ops[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
const BASE = process.argv.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:3203";
const API = ops.SV_API_BASE ?? "https://softwarevala.net";
const RUN = `chat-verify-${Date.now()}`;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(74)} ${detail}`);
};

function sql(q) {
  let r;
  for (let attempt = 1; ; attempt++) {
    r = spawnSync("node", ["scripts/ops/db.mjs", "--sql", q], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
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
const uid = (email) => one(`select id from auth.users where email='${email}'`);

const RESELLER = uid("test.reseller@softwarevala.test");
const AUTHOR = uid("test.author@softwarevala.test");
const VENDOR = uid("test.vendor@softwarevala.test");
const CONV = randomUUID();
const SUBJECT = `Chat check ${RUN}`;
const baseline = () => one(`select (select count(*) from conversations) || '/' || (select count(*) from conversation_participants) || '/' || (select count(*) from messages) || '/' || (select count(*) from role_permissions) || '/' || (select count(*) from chat_handoffs)`);
const before = baseline();

const browser = await chromium.launch();
async function signIn(login, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
  if (login) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3000);
    await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]);
    await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  }
  return { context, page, errors };
}
const tokenOf = (p) => p.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => /auth-token$/.test(x));
  return k ? JSON.parse(localStorage.getItem(k) ?? "{}").access_token ?? null : null;
});
const button = (p) => p.locator("[data-chat-app-button]");
async function visit(p, path, wait = 6000) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(wait);
}
// The stream itself, read raw, counting chat announcements by conversation.
const RAW = async (t) => {
  window.__chat = [];
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
        if (/^event: notification$/m.test(block) && data) {
          const d = JSON.parse(data[1]);
          if (String(d.event).startsWith("chat.")) window.__chat.push(d);
        }
      }
    }
  })();
  return r.status;
};

let created = false;
let permissionWithdrawn = false;
try {
  /* ------------------------------------------------ the button */
  const visitor = await signIn(null);
  await visit(visitor.page, "/");
  check("a visitor sees no chat button on the home page", (await button(visitor.page).count()) === 0);
  await visitor.context.close();

  const reseller = await signIn("RESELLER");
  await visit(reseller.page, "/dashboard/reseller");
  check("the reseller dashboard top bar has the chat button", (await button(reseller.page).count()) === 1);
  await visit(reseller.page, "/");
  check("the home page header has it for a signed-in person", (await button(reseller.page).count()) >= 1);
  await button(reseller.page).first().click();
  await reseller.page.waitForURL((u) => u.pathname === "/chat", { timeout: 15_000 }).catch(() => undefined);
  check("it opens the internal chat", new URL(reseller.page.url()).pathname === "/chat", reseller.page.url());

  const dev = await signIn("DEVELOPER");
  await visit(dev.page, "/ams/overview");
  check("the AMS Manager top bar has it", (await button(dev.page).count()) === 1);
  await dev.context.close();

  const owner = await signIn("CONTROL_PANEL");
  await visit(owner.page, "/chat-manager", 8000);
  const cmText = (await owner.page.locator("body").innerText()).replace(/\s+/g, " ");
  check("Chat Manager opens for its operator", /Live Conversations/.test(cmText) && /Handoff Queue/.test(cmText) && !/Access restricted/i.test(cmText), cmText.slice(0, 80));
  check("the manager consoles' top bar has the chat button", (await button(owner.page).count()) === 1);
  check("Chat Manager reports no data error", !/(does not exist|permission denied|not permitted|Failed to fetch)/i.test(cmText));
  check("no page error in Chat Manager", owner.errors.length === 0, owner.errors.slice(0, 2).join(" | "));

  /* ------------------------------------------------ live chat */
  sql(`begin;
    insert into conversations (id, subject, kind, created_by) values ('${CONV}', '${SUBJECT}', 'direct', '${RESELLER}');
    insert into conversation_participants (conversation_id, user_id) values ('${CONV}', '${RESELLER}'), ('${CONV}', '${AUTHOR}');
    commit;`);
  created = true;
  const author = await signIn("AUTHOR");
  await visit(author.page, "/chat", 5000);
  await author.page.evaluate(RAW, await tokenOf(author.page));
  const vendor = await signIn("VENDOR");
  await visit(vendor.page, "/dashboard/vendor", 4000);
  await vendor.page.evaluate(RAW, await tokenOf(vendor.page));
  await author.page.getByRole("button", { name: new RegExp(SUBJECT) }).first().click();
  await author.page.waitForTimeout(2500);

  const body = `live ${RUN}`;
  const resellerToken = await tokenOf(reseller.page);
  const userHeaders = (t) => ({ Authorization: `Bearer ${t}`, apikey: ops.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", Prefer: "return=representation" });
  const sent = await fetch(`${API}/rest/v1/messages`, {
    method: "POST", headers: userHeaders(resellerToken),
    body: JSON.stringify({ conversation_id: CONV, sender_id: RESELLER, body }),
  }).then(async (r) => ({ status: r.status, rows: await r.json().catch(() => null) }));
  const messageId = Array.isArray(sent.rows) ? sent.rows[0]?.id : null;
  check("the reseller sends a message as themselves", sent.status === 201 && Boolean(messageId), `status ${sent.status}`);
  const t0 = Date.now();
  let arrived = false;
  while (Date.now() - t0 < 15_000 && !arrived) {
    arrived = (await author.page.getByText(body).count()) > 0;
    if (!arrived) await author.page.waitForTimeout(250);
  }
  check("it appears in the author's open chat without a reload", arrived, arrived ? `${Date.now() - t0} ms` : "not within 15 s");
  const authorEvents = await author.page.evaluate(() => window.__chat);
  check("it came over the stream, naming the conversation and the sender", authorEvents.some((e) => e.event === "chat.message" && e.conversation_id === CONV && e.sender_id === RESELLER && e.id === messageId), JSON.stringify(authorEvents.slice(0, 2)));
  const vendorEvents = await vendor.page.evaluate(() => window.__chat);
  check("someone outside the conversation receives nothing", vendorEvents.filter((e) => e.conversation_id === CONV).length === 0, `${vendorEvents.length} chat events`);

  /* ------------------------------------------------ the rules */
  const edit = await fetch(`${API}/rest/v1/messages?id=eq.${messageId}`, { method: "PATCH", headers: userHeaders(resellerToken), body: JSON.stringify({ body: "edited" }) });
  const del = await fetch(`${API}/rest/v1/messages?id=eq.${messageId}`, { method: "DELETE", headers: userHeaders(resellerToken) });
  const stored = one(`select body from messages where id='${messageId}'`);
  check("a message cannot be edited or deleted, even by its sender", stored === body, `patch ${edit.status}, delete ${del.status}, body "${stored}"`);
  const copyBlocked = await author.page.evaluate((text) => {
    const el = [...document.querySelectorAll("*")].find((n) => n.childElementCount === 0 && n.textContent?.includes(text));
    if (!el) return "no element";
    const ev = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }, body);
  check("copying from the chat is blocked", copyBlocked === true, String(copyBlocked));
  const ownerToken = await tokenOf(owner.page);
  const vendorToken = await tokenOf(vendor.page);
  const managerRead = await fetch(`${API}/rest/v1/messages?select=id&conversation_id=eq.${CONV}`, { headers: userHeaders(ownerToken) }).then((r) => r.json());
  const outsiderRead = await fetch(`${API}/rest/v1/messages?select=id&conversation_id=eq.${CONV}`, { headers: userHeaders(vendorToken) }).then((r) => r.json());
  check("Chat Manager's operator can read the conversation; an outsider cannot", Array.isArray(managerRead) && managerRead.length === 1 && Array.isArray(outsiderRead) && outsiderRead.length === 0, `manager ${JSON.stringify(managerRead).length > 2 ? managerRead.length : 0}, outsider ${Array.isArray(outsiderRead) ? outsiderRead.length : outsiderRead?.message}`);
  const outsiderSend = await fetch(`${API}/rest/v1/messages`, { method: "POST", headers: userHeaders(vendorToken), body: JSON.stringify({ conversation_id: CONV, sender_id: VENDOR, body: "intrusion" }) });
  check("an outsider cannot post into the conversation", outsiderSend.status >= 400, `status ${outsiderSend.status}`);

  /* ------------------------------------------------ control from Chat Manager */
  // What the Role Access Matrix does: withdraw a permission from a role.
  one(`with d as (delete from role_permissions where role='vendor' and permission='message.send' returning 1) select count(*) from d`);
  permissionWithdrawn = true;
  await visit(vendor.page, "/dashboard/vendor");
  check("withdrawn in Chat Manager, the vendor's chat button disappears", (await button(vendor.page).count()) === 0);
  one(`with i as (insert into role_permissions (role, permission) values ('vendor', 'message.send') on conflict do nothing returning 1) select count(*) from i`);
  permissionWithdrawn = false;
  await visit(vendor.page, "/dashboard/vendor");
  check("restored, it comes back", (await button(vendor.page).count()) === 1);

  check("no page error for the reseller or author", reseller.errors.length === 0 && author.errors.length === 0, [...reseller.errors, ...author.errors].slice(0, 2).join(" | "));
  await Promise.all([reseller.context.close(), author.context.close(), vendor.context.close(), owner.context.close()]);
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 400) : error}`);
} finally {
  if (permissionWithdrawn) {
    one(`with i as (insert into role_permissions (role, permission) values ('vendor', 'message.send') on conflict do nothing returning 1) select count(*) from i`);
  }
  if (created) {
    // Messages are immutable to everyone; the test conversation is removed
    // with the guard lifted for exactly this statement set.
    sql(`begin;
      alter table messages disable trigger messages_immutable_delete;
      delete from message_receipts where message_id in (select id from messages where conversation_id='${CONV}');
      delete from message_reactions where message_id in (select id from messages where conversation_id='${CONV}');
      delete from messages where conversation_id='${CONV}';
      alter table messages enable trigger messages_immutable_delete;
      delete from chat_handoffs where conversation_id='${CONV}';
      delete from conversation_participants where conversation_id='${CONV}';
      delete from conversations where id='${CONV}';
      commit;`);
  }
  const after = baseline();
  check("everything the run created is gone, and permissions are as they were", after === before, `${before} -> ${after}`);
  const guard = one(`select tgenabled::text from pg_trigger where tgname='messages_immutable_delete'`);
  check("the message immutability guard is back on", guard === "O", guard);
  await browser.close();
}

console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
