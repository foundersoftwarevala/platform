/**
 * The internal chat across every role dashboard, and Chat Manager reached from
 * Control Panel - real accounts, real database, real live delivery.
 *
 *   node scripts/ops/chat-roles-verify.mjs [base]
 *
 * One test group with the nine role test accounts. Each person opens their own
 * role dashboard, clicks the chat button there, opens the group and types a
 * message into the real composer. Every other member's open chat must show
 * each message, without a reload, and the database must hold exactly one row
 * per message from the right sender. Then the operator opens Control Panel,
 * clicks Chat Manager, and finds the group among Live Conversations.
 * The group and its messages are removed afterwards.
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
const RUN = `chat-roles-${Date.now()}`;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(78)} ${detail}`);
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
  if (r.status !== 0 || /\b(ERROR|FATAL|PANIC):|permission denied/i.test(`${out}\n${r.stderr ?? ""}`)) throw new Error(`${r.stderr ?? ""}${out}`.slice(0, 800));
  return out.split("\n").map((l) => l.trim()).filter((l) => l && !/^target|^-+(\+-+)*$|rows?\)$/.test(l));
}
const one = (q) => sql(q)[1] ?? "";

// Each person and the dashboard their role opens.
const MEMBERS = [
  ["RESELLER", "reseller"], ["AUTHOR", "author"], ["VENDOR", "vendor"], ["AFFILIATE", "affiliate"],
  ["INFLUENCER", "influencer"], ["FRANCHISE", "franchise"], ["SEO", "seo"], ["DEVELOPER", "developer"],
  ["ADMIN", "admin"],
];
const ids = Object.fromEntries(MEMBERS.map(([login]) => [login, one(`select id from auth.users where email='${ops[`SV_LOGIN_${login}`]}'`)]));
const GROUP = randomUUID();
const SUBJECT = `All roles ${RUN}`;
const baseline = () => one(`select (select count(*) from conversations) || '/' || (select count(*) from conversation_participants) || '/' || (select count(*) from messages) || '/' || (select count(*) from message_receipts)`);
const before = baseline();

const browser = await chromium.launch();
const people = [];
let created = false;
try {
  sql(`begin;
    insert into conversations (id, subject, kind, created_by) values ('${GROUP}', '${SUBJECT}', 'group', '${ids.RESELLER}');
    insert into conversation_participants (conversation_id, user_id) values ${MEMBERS.map(([l]) => `('${GROUP}', '${ids[l]}')`).join(", ")};
    commit;`);
  created = true;

  // Everyone signs in, opens their own dashboard, and takes the chat button there.
  for (const [login, role] of MEMBERS) {
    // Each member in a browser of their own, as real users are. Contexts of one
    // browser share its connection pool: over HTTP/1.1 to a local server, the
    // seventh long-lived notification stream waits for a free socket and that
    // member never hears live messages. The live site is HTTP/2, where this
    // limit does not exist.
    const ownBrowser = await chromium.launch();
    const context = await ownBrowser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();
    const errors = [];
    const consoleErrors = [];
    const streams = [];
    page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140)); });
    page.on("response", (r) => { if (r.url().includes("/api/notifications/stream")) streams.push(r.status()); });
    const pending = new Map();
    page.on("request", (r) => { if (/\/rest\/v1\/|_serverFn|\/api\//.test(r.url())) pending.set(r, Date.now()); });
    page.on("requestfinished", async (r) => { const res = await r.response().catch(() => null); if (res && res.status() >= 400) consoleErrors.push(`HTTP ${res.status()} ${new URL(r.url()).pathname}`); pending.delete(r); });
    page.on("requestfailed", (r) => { consoleErrors.push(`failed ${new URL(r.url()).pathname} ${r.failure()?.errorText ?? ""}`); pending.delete(r); });
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2500);
    await page.fill('input[type="email"]', ops[`SV_LOGIN_${login}`]);
    await page.fill('input[type="password"]', ops[`SV_PW_${login}`] ?? ops.SV_PW_TEST ?? ops.SV_PW_CONTROL_PANEL);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    await page.goto(`${BASE}/dashboard/${role}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    console.log(`  ..    ${role} dashboard opened`);
    const btn = page.locator("[data-chat-app-button]");
    const hasButton = (await btn.count()) === 1;
    if (hasButton) await btn.first().click();
    await page.waitForURL((u) => u.pathname === "/chat", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: new RegExp(SUBJECT) }).first().click({ timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const composer = page.getByPlaceholder(/Type a message/);
    people.push({ login, role, browser: ownBrowser, context, page, errors, consoleErrors, streams, pending, hasButton, ready: (await composer.count()) > 0 });
  }
  for (const p of people) {
    check(`${p.role.padEnd(10)} dashboard: chat button there, opens the group ready to type`, p.hasButton && p.ready, `button ${p.hasButton}, composer ${p.ready}`);
  }

  // Each person sends one message through the real composer; everyone else
  // must see it arrive.
  const sentAt = {};
  for (const p of people) {
    if (!p.ready) continue;
    const text = `hello from ${p.role} ${RUN}`;
    const composer = p.page.getByPlaceholder(/Type a message/);
    await composer.click();
    await composer.fill(text);
    await composer.press("Enter");
    sentAt[p.role] = Date.now();
    await p.page.waitForTimeout(400);
  }
  const deadline = Date.now() + 20_000;
  const seen = {};
  for (const p of people) seen[p.role] = new Set();
  while (Date.now() < deadline) {
    for (const p of people) {
      for (const q of people) {
        if (seen[p.role].has(q.role)) continue;
        if ((await p.page.getByText(`hello from ${q.role} ${RUN}`, { exact: false }).count()) > 0) seen[p.role].add(q.role);
      }
    }
    if (people.every((p) => seen[p.role].size === people.length)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const p of people) {
    const missing = people.filter((q) => !seen[p.role].has(q.role)).map((q) => q.role);
    check(`${p.role.padEnd(10)} sees every member's message live, no reload`, missing.length === 0, missing.length ? `missing: ${missing.join(",")}` : `${seen[p.role].size}/${people.length}`);
    if (missing.length) {
      // What that member's page actually shows, not just whether a composer exists.
      const view = await p.page.evaluate((subject) => ({
        url: location.pathname + location.search,
        rendered: document.querySelectorAll("[data-message-id]").length,
        open: [...document.querySelectorAll("h1,h2,h3,header *")].map((e) => e.textContent?.trim() ?? "").find((t) => t.includes(subject)) ?? null,
        texts: [...document.querySelectorAll("[data-message-id]")].slice(-3).map((e) => (e.textContent ?? "").trim().slice(0, 50)),
        pane: (document.querySelector("main")?.innerText ?? "").replace(/s+/g, " ").slice(0, 200),
      }), SUBJECT).catch((e) => ({ error: String(e) }));
      console.log(`  ..    ${p.role}: ${JSON.stringify(view)} stream HTTP ${p.streams.join(",") || "none"} console errors ${p.consoleErrors.slice(0, 4).join(" | ") || "none"} pending ${[...p.pending.entries()].filter(([r]) => !r.url().includes("notifications/stream")).map(([r, t]) => `${new URL(r.url()).pathname.split("/").pop()} ${Math.round((Date.now() - t) / 1000)}s`).join(", ") || "none"}`);
    }
  }
  const stored = sql(`select m.body || ' | ' || coalesce((select string_agg(ur.role::text, ',') from user_roles ur where ur.user_id = m.sender_id), '?') from messages m where m.conversation_id='${GROUP}' order by m.created_at`).slice(1);
  const rightSender = people.filter((p) => p.ready).every((p) => stored.some((l) => l.startsWith(`hello from ${p.role} ${RUN} |`) && l.split("|").pop().trim().split(",").includes(p.role)));
  check("the database holds one message per member, each from that member", stored.length === people.filter((p) => p.ready).length && rightSender, `${stored.length} rows`);
  check("no page error in any member's chat", people.every((p) => p.errors.length === 0), people.flatMap((p) => p.errors).slice(0, 2).join(" | "));

  /* ------------------------------------------------ Control Panel -> Chat Manager */
  const opCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const op = await opCtx.newPage();
  const opErrors = [];
  op.on("pageerror", (e) => opErrors.push(String(e.message ?? e)));
  await op.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await op.waitForTimeout(2500);
  await op.fill('input[type="email"]', ops.SV_LOGIN_CONTROL_PANEL);
  await op.fill('input[type="password"]', ops.SV_PW_CONTROL_PANEL ?? ops.SV_PW_TEST);
  await op.click('button[type="submit"]');
  await op.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await op.goto(`${BASE}/control-panel`, { waitUntil: "domcontentloaded" });
  await op.waitForTimeout(6000);
  const entry = op.getByRole("button", { name: /^Chat Manager$/ }).or(op.getByText("Chat Manager", { exact: true })).first();
  const entryVisible = await entry.isVisible().catch(() => false);
  if (entryVisible) await entry.click();
  await op.waitForURL((u) => u.pathname.startsWith("/chat-manager"), { timeout: 20_000 }).catch(() => undefined);
  check("Control Panel has Chat Manager, and it opens", entryVisible && new URL(op.url()).pathname.startsWith("/chat-manager"), op.url());
  await op.waitForTimeout(5000);
  await op.getByRole("button", { name: /Live Conversations/ }).first().click().catch(() => undefined);
  await op.waitForTimeout(4000);
  const listed = (await op.getByText(SUBJECT).count()) > 0;
  check("Chat Manager's Live Conversations lists the group, from the real database", listed);
  check("no page error in Control Panel or Chat Manager", opErrors.length === 0, opErrors.slice(0, 2).join(" | "));
  await opCtx.close();
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.message.slice(0, 3000) : error}`);
} finally {
  for (const p of people) {
    await p.context.close().catch(() => undefined);
    await p.browser?.close().catch(() => undefined);
  }
  if (created) {
    sql(`begin;
      alter table messages disable trigger messages_immutable_delete;
      delete from message_receipts where message_id in (select id from messages where conversation_id='${GROUP}');
      delete from message_reactions where message_id in (select id from messages where conversation_id='${GROUP}');
      delete from message_mentions where message_id in (select id from messages where conversation_id='${GROUP}');
      delete from messages where conversation_id='${GROUP}';
      alter table messages enable trigger messages_immutable_delete;
      delete from chat_handoffs where conversation_id='${GROUP}';
      delete from conversation_participants where conversation_id='${GROUP}';
      delete from conversations where id='${GROUP}';
      commit;`);
  }
  const after = baseline();
  check("the group, its messages and receipts are gone; counts as before", after === before, `${before} -> ${after}`);
  check("the message immutability guard is back on", one(`select tgenabled::text from pg_trigger where tgname='messages_immutable_delete'`) === "O");
  await browser.close();
}
console.log(`\n  ${failed ? `${failed} failed` : "all passed"}`);
process.exit(failed ? 1 : 0);
