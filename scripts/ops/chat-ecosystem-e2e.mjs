/**
 * Chat App <-> Chat Manager, end to end, against the deployed site and the VPS
 * database. Real accounts, real browsers, real AI provider, real translation
 * engine, real Storage.
 *
 *   node scripts/ops/chat-ecosystem-e2e.mjs
 *
 * Customer  = the AUTHOR test account (does not run conversations: Chat App only)
 * Outsider  = the VENDOR test account
 * Manager   = the ADMIN test account (chat.manage, chat.assign, chat.moderate)
 * Handler 2 = the MARKETPLACE test account (chat.assign), for reassignment
 *
 * Writes only conversations it creates for these test accounts. At the end the
 * test conversations, their rows and their stored files are removed; audit_logs
 * entries are kept (they are the audit). Prints PASS/FAIL per check and exits
 * non-zero on any failure.
 */
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { BASE, call, listen, loadFunctionIds, one, ops, rows, sql, token } from "./chat-ecosystem-lib.mjs";

const RUN = `e2e-${Date.now().toString(36)}`;
let failed = 0;
const results = [];
const check = (test, name, ok, detail = "") => {
  if (!ok) failed += 1;
  results.push({ test, name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  [${test}] ${name.padEnd(70)} ${String(detail).slice(0, 220)}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 30_000, every = 1_000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(every);
  }
}
const q = (s) => s.replace(/'/g, "''");

loadFunctionIds();
const C = await token(ops.SV_LOGIN_AUTHOR, ops.SV_PW_TEST);
const O = await token(ops.SV_LOGIN_VENDOR, ops.SV_PW_TEST);
const M = await token(ops.SV_LOGIN_ADMIN, ops.SV_PW_TEST);
const H2 = one(`select id from auth.users where email='${q(ops.SV_LOGIN_MARKETPLACE)}'`);
const BOT = one(`select id from profiles where handle='vala-ai'`);

const openBefore = one(`select count(*) from conversations where created_by in ('${C.id}','${O.id}') and kind='support' and status not in ('closed','resolved')`);
if (openBefore !== "0") {
  console.log(`ABORT: the test accounts already have ${openBefore} open support conversation(s) that this run did not create.`);
  process.exit(2);
}
const auditFrom = one(`select now()`);
const created = new Set();
const storedPaths = [];
const browsers = [];

async function signIn(email) {
  const browser = await chromium.launch();
  browsers.push(browser);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', ops.SV_PW_TEST);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
  return { browser, context, page };
}
const sees = (page, text, ms = 20_000) =>
  page.getByText(text, { exact: false }).first().waitFor({ timeout: ms }).then(() => true).catch(() => false);
async function say(page, text) {
  const box = page.getByPlaceholder(/Type a message/);
  await box.click();
  await box.fill(text);
  await box.press("Enter");
}
const msgCount = (conv, like) => Number(one(`select count(*) from messages where conversation_id='${conv}' and body like '${q(like)}'`));

let CONV = null;
try {
  // ------------------------------------------------------------------ setup
  const customer = await signIn(ops.SV_LOGIN_AUTHOR);
  await customer.page.evaluate(() =>
    localStorage.setItem("vala.chat.preferences", JSON.stringify({ language: "hi", autoTranslate: true, sound: false })),
  );
  await customer.page.goto(`${BASE}/chat`);
  await customer.page.waitForTimeout(3500);
  await customer.page.getByRole("button", { name: /^New$/ }).first().click({ timeout: 20_000 });
  CONV = await until(async () => one(`select id from conversations where created_by='${C.id}' and kind='support' and status not in ('closed','resolved') order by created_at desc limit 1`) || null, 20_000);
  if (!CONV) throw new Error("the Chat App did not open a support conversation");
  created.add(CONV);
  check("setup", "customer opened a support conversation from the Chat App", true, CONV);
  check("setup", "it has exactly one participant (the customer), AI on", one(`select count(*)||'/'||(select ai_enabled from conversations where id='${CONV}') from conversation_participants where conversation_id='${CONV}'`) === "1/true");

  const manager = await signIn(ops.SV_LOGIN_ADMIN);
  await manager.page.goto(`${BASE}/chat-manager`);
  await manager.page.waitForTimeout(3500);
  await manager.page.getByText("Live Conversations", { exact: true }).first().click({ timeout: 20_000 });
  await manager.page.waitForTimeout(2500);

  // Manager-channel stream, held open across the first tests.
  const managerStream = listen(M, 60_000);
  const customerStream = listen(C, 60_000);
  await sleep(4000); // both streams authenticated and subscribed

  // ---------------------------------------------------------------- TEST 1
  const t1 = `T1 ${RUN} hello, I need help with my licence`;
  await say(customer.page, t1);
  const persisted1 = await until(async () => msgCount(CONV, t1) === 1, 15_000);
  check("T1", "customer message persisted once in the VPS database", !!persisted1);
  check("T1", "Chat Manager queue shows it live, without reload", await sees(manager.page, `T1 ${RUN}`, 25_000));

  // ---------------------------------------------------------------- TEST 3
  const ai = await until(async () => {
    const r = rows(`select m.id, left(m.body, 80), e.outcome, coalesce(e.agent_key,'(generic Vala AI)'), e.latency_ms from messages m left join chat_ai_events e on e.message_id=m.id where m.conversation_id='${CONV}' and m.kind='ai' and m.sender_id='${BOT}' order by m.created_at limit 1`);
    return r[0] ?? null;
  }, 90_000, 2_000);
  check("T3", "AI reply persisted as Vala AI (kind=ai)", !!ai, ai ? `${ai[2]} by ${ai[3]} in ${ai[4]} ms: "${ai[1]}"` : "no AI reply within 90 s");
  const usage = rows(`select s.name, u.model_id, u.status_code, u.success, u.tokens_in, u.tokens_out, u.latency_ms from usage_events u join api_services s on s.id=u.service_id where u.product='chat' and u.occurred_at > '${auditFrom}' order by u.occurred_at desc limit 3`);
  check("T3", "a real provider call was metered for the reply", usage.some((u) => u[3] === "t"), usage.map((u) => u.join(" ")).join(" | "));
  if (ai) check("T3", "customer sees the AI reply live", await sees(customer.page, ai[1].slice(0, 30), 30_000));
  const events = rows(`select outcome from chat_ai_events where conversation_id='${CONV}'`);
  check("T3", "AI outcome recorded in chat_ai_events", events.length > 0, events.map((e) => e[0]).join(","));

  // ---------------------------------------------------------------- TEST 2
  await manager.page.goto(`${BASE}/chat-manager?conversationId=${CONV}`);
  await manager.page.waitForTimeout(4000);
  const t2 = `T2 ${RUN} operator here, I can help with that`;
  const replyBox = manager.page.getByLabel("Reply to customer");
  await replyBox.fill(t2);
  await manager.page.getByRole("button", { name: "Send reply" }).click();
  check("T2", "manager reply persisted in the same conversation", !!(await until(async () => msgCount(CONV, t2) === 1, 15_000)));
  check("T2", "manager joined as a participant (Software Vala Support)", one(`select role_label from conversation_participants where conversation_id='${CONV}' and user_id='${M.id}'`) === "Software Vala Support");
  check("T2", "customer receives the manager reply live", await sees(customer.page, `T2 ${RUN}`, 25_000));
  check("T2", "audit chat.message.operator_sent recorded", one(`select count(*) from audit_logs where action='chat.message.operator_sent' and entity_id='${CONV}'`) !== "0");

  const mEvents = await managerStream;
  const cEvents = await customerStream;
  check("T9", "manager stream carried this conversation's changes", mEvents.some((e) => e.conversation_id === CONV && e.event === "chat.message"), `${mEvents.length} events`);
  check("T9", "customer stream carried only its own conversation", cEvents.length > 0 && cEvents.every((e) => !e.conversation_id || e.conversation_id === CONV), `${cEvents.length} events`);

  // ---------------------------------------------------------------- TEST 4
  await manager.page.goto(`${BASE}/chat-manager`);
  await manager.page.waitForTimeout(3000);
  await manager.page.getByText("Handoff Queue", { exact: true }).first().click();
  await manager.page.waitForTimeout(2000);
  await customer.page.getByRole("button", { name: "Talk to a human agent" }).click();
  const handoff = await until(async () => one(`select id from chat_handoffs where conversation_id='${CONV}' and status='pending'`) || null, 15_000);
  check("T4", "customer handoff request recorded (pending)", !!handoff);
  check("T4", "conversation escalated with AI off", one(`select status||'/'||ai_enabled from conversations where id='${CONV}'`) === "escalated/false");
  check("T4", "Handoff Queue shows it live, without reload", await manager.page.getByRole("button", { name: "Accept" }).first().waitFor({ timeout: 25_000 }).then(() => true).catch(() => false));
  await manager.page.getByRole("button", { name: "Accept" }).first().click();
  const accepted = await until(async () => one(`select status from chat_handoffs where id='${handoff}'`) === "accepted", 15_000);
  check("T4", "manager accepted the handoff", !!accepted);
  check("T4", "conversation assigned to the manager, open, AI off", one(`select (assigned_agent_id='${M.id}')||'/'||status||'/'||ai_enabled from conversations where id='${CONV}'`) === "true/open/false");
  const t4 = `T4 ${RUN} a human teammate is now with you`;
  const r4 = await call(M, "sendChatManagerMessage", "POST", { conversationId: CONV, body: t4 });
  check("T4", "manager replies after accepting", r4.ok, r4.error ?? "");
  check("T4", "customer receives the human reply live", await sees(customer.page, `T4 ${RUN}`, 25_000));
  check("T4", "no AI reply after the handoff", one(`select count(*) from messages where conversation_id='${CONV}' and kind='ai' and created_at > (select created_at from chat_handoffs where id='${handoff}')`) === "0");
  await manager.page.getByRole("button", { name: "Resolve" }).first().click();
  check("T4", "manager resolved the accepted handoff from the Handoff Queue", !!(await until(async () => one(`select status from chat_handoffs where id='${handoff}'`) === "resolved", 15_000)));
  check("T4", "handoff audit trail (accepted, resolved)", one(`select string_agg(action, ',' order by occurred_at) from audit_logs where entity_id='${handoff}'`) === "chat.handoff.accepted,chat.handoff.resolved");

  // ---------------------------------------------------------------- TEST 5
  const hindi = `T5 ${RUN} नमस्ते, मुझे अपने लाइसेंस के नवीनीकरण के बारे में मदद चाहिए।`;
  await say(customer.page, hindi);
  const hindiId = await until(async () => one(`select id from messages where conversation_id='${CONV}' and body='${q(hindi)}'`) || null, 15_000);
  const toAr = await until(async () => {
    const r = await call(M, "translateUserChatMessages", "POST", { conversationId: CONV, messageIds: [hindiId], target: "ar" });
    const v = r.value?.[0];
    return v && v.status === "completed" ? v : null;
  }, 90_000, 3_000);
  check("T5", "Hindi -> Arabic delivered to the reader", !!toAr && /[؀-ۿ]/.test(toAr.text ?? ""), toAr ? `${toAr.sourceLanguage} -> ar: ${toAr.text?.slice(0, 60)}` : "no translation");
  const rowsHi = rows(`select target_language, status, source_language, provider from chat_message_translations where message_id='${hindiId}' order by target_language`);
  check("T5", "stored: canonical English + Arabic, source detected as Hindi", rowsHi.some((r) => r[0] === "en" && r[1] === "completed") && rowsHi.some((r) => r[0] === "ar" && r[1] === "completed") && rowsHi.every((r) => r[2] === "hi"), rowsHi.map((r) => r.join(":")).join(" | "));
  check("T5", "original Hindi message unchanged", one(`select body from messages where id='${hindiId}'`) === hindi);

  const arabic = `T5 ${RUN} مرحبا، سيتم تجديد ترخيصك اليوم.`;
  const ra = await call(M, "sendChatManagerMessage", "POST", { conversationId: CONV, body: arabic });
  const arId = await until(async () => one(`select id from messages where conversation_id='${CONV}' and body='${q(arabic)}'`) || null, 15_000);
  check("T5", "manager wrote in Arabic", ra.ok && !!arId);
  const toHi = await until(async () => {
    const r = await call(C, "translateUserChatMessages", "POST", { conversationId: CONV, messageIds: [arId], target: "hi" });
    const v = r.value?.[0];
    return v && v.status === "completed" ? v : null;
  }, 90_000, 3_000);
  check("T5", "Arabic -> Hindi delivered to the customer", !!toHi && /[ऀ-ॿ]/.test(toHi.text ?? ""), toHi ? `${toHi.sourceLanguage} -> hi: ${toHi.text?.slice(0, 60)}` : "no translation");
  const rowsAr = rows(`select target_language, status, source_language from chat_message_translations where message_id='${arId}' order by target_language`);
  check("T5", "stored: canonical English + Hindi, source detected as Arabic", rowsAr.some((r) => r[0] === "en" && r[1] === "completed") && rowsAr.some((r) => r[0] === "hi" && r[1] === "completed") && rowsAr.every((r) => r[2] === "ar"), rowsAr.map((r) => r.join(":")).join(" | "));
  check("T5", "customer's Chat App shows the Hindi translation (auto-translate)", toHi ? await sees(customer.page, toHi.text.slice(0, 12), 40_000) : false);
  const tr = await call(M, "getConversationTranscript", "GET", { conversationId: CONV, limit: 100 });
  const trAr = tr.value?.find?.((m) => m.id === arId);
  check("T5", "Chat Manager transcript shows the stored translations", !!trAr && trAr.translations.some((t) => t.target_language === "hi" && t.status === "completed"), trAr ? trAr.translations.map((t) => `${t.target_language}:${t.status}`).join(",") : tr.error);

  // ---------------------------------------------------------------- TEST 6
  const fileText = `Software Vala chat attachment ${RUN}\n`;
  await customer.page.locator('input[type="file"]').first().setInputFiles({ name: `e2e-${RUN}.txt`, mimeType: "text/plain", buffer: Buffer.from(fileText) });
  await customer.page.waitForTimeout(800);
  await say(customer.page, `T6 ${RUN} file attached`);
  const att = await until(async () => rows(`select a.id, a.storage_path, a.size_bytes from message_attachments a join messages m on m.id=a.message_id where m.conversation_id='${CONV}' and a.file_name='e2e-${RUN}.txt'`)[0] ?? null, 30_000);
  check("T6", "upload authorized by the server and recorded", !!att, att ? att.join(" ") : "no attachment row");
  if (att) {
    storedPaths.push(att[1]);
    const view = await call(C, "getUserChatAttachmentUrl", "GET", { attachmentId: att[0] });
    const bytes = view.ok ? await fetch(`${BASE}/storage/v1${view.value.signedPath}`).then((r) => r.text()) : "";
    check("T6", "customer opens it through a signed URL; bytes match", bytes === fileText, view.error ?? `${bytes.length} bytes`);
    const dl = await call(C, "getUserChatAttachmentUrl", "GET", { attachmentId: att[0], download: true });
    check("T6", "customer with attachment.download gets a download URL", dl.ok && /download=/.test(dl.value?.signedPath ?? ""), dl.error ?? "");
    const mgr = await call(M, "getChatManagerAttachmentUrl", "GET", { attachmentId: att[0] });
    const mbytes = mgr.ok ? await fetch(`${BASE}/storage/v1${mgr.value.signedPath}`).then((r) => r.text()) : "";
    check("T6", "Chat Manager opens the same file", mbytes === fileText, mgr.error ?? "");
    const out = await call(O, "getUserChatAttachmentUrl", "GET", { attachmentId: att[0] });
    check("T6", "outsider is refused the file", !out.ok, out.error ?? "ALLOWED");
    const forged = await fetch(`${BASE}/storage/v1/object/sign/chat-files/${att[1]}?token=forged`).then((r) => r.status);
    check("T6", "a forged signed URL is refused by Storage", forged >= 400, `HTTP ${forged}`);
    const direct = await fetch(`${BASE}/storage/v1/object/chat-files/${CONV}/x/${RUN}.txt`, { method: "POST", headers: { authorization: `Bearer ${O.token}`, apikey: ops.SUPABASE_PUBLISHABLE_KEY, "content-type": "text/plain" }, body: "x" }).then((r) => r.status);
    check("T6", "outsider cannot write into the conversation's folder directly", direct >= 400, `HTTP ${direct}`);
  }
  const msgForBig = one(`select id from messages where conversation_id='${CONV}' and sender_id='${C.id}' order by created_at desc limit 1`);
  const big = await call(C, "prepareUserChatUpload", "POST", { conversationId: CONV, messageId: msgForBig, fileName: "big.bin", sizeBytes: 26 * 1024 * 1024 });
  check("T6", "26 MB upload refused by the server (25 MB limit)", !big.ok, big.error ?? "ALLOWED");
  const notMine = await call(C, "prepareUserChatUpload", "POST", { conversationId: CONV, messageId: arId, fileName: "x.txt", sizeBytes: 10 });
  check("T6", "customer cannot attach to someone else's message", !notMine.ok, notMine.error ?? "ALLOWED");

  // ---------------------------------------------------------------- TEST 7
  const as1 = await call(M, "updateConversationControls", "POST", { conversationId: CONV, assignedAgentId: H2 });
  check("T7", "manager reassigns to a second handler", as1.ok, as1.error ?? "");
  check("T7", "DB: new assignee set and joined as participant", one(`select (c.assigned_agent_id='${H2}')||'/'||exists(select 1 from conversation_participants p where p.conversation_id=c.id and p.user_id='${H2}') from conversations c where c.id='${CONV}'`) === "true/true");
  check("T7", "audit chat.conversation.transferred recorded", one(`select count(*) from audit_logs where action='chat.conversation.transferred' and entity_id='${CONV}'`) !== "0");
  const queue = await call(M, "getChatManagerQueue", "GET", { filters: { q: RUN } });
  const qrow = queue.value?.rows?.find?.((r) => r.id === CONV);
  check("T7", "Chat Manager queue shows the new handler", !!qrow && !!qrow.handler_name, qrow ? `handler ${qrow.handler_name}` : queue.error);
  const badAssignee = await call(M, "updateConversationControls", "POST", { conversationId: CONV, assignedAgentId: C.id });
  check("T7", "assigning a customer as handler is refused", !badAssignee.ok, badAssignee.error ?? "ALLOWED");
  const back = await call(M, "updateConversationControls", "POST", { conversationId: CONV, assignedAgentId: M.id });
  check("T7", "reassigned back to the first manager", back.ok && one(`select assigned_agent_id from conversations where id='${CONV}'`) === M.id);
  const t7 = `T7 ${RUN} customer still chatting after reassignment`;
  await say(customer.page, t7);
  check("T7", "customer can keep chatting after reassignment", !!(await until(async () => msgCount(CONV, t7) === 1, 15_000)));

  // ---------------------------------------------------------------- TEST 8
  const secret = `T8 ${RUN} my card number is 4111 1111 1111 1111`;
  await say(customer.page, secret);
  const secretId = await until(async () => one(`select id from messages where conversation_id='${CONV}' and body='${q(secret)}'`) || null, 15_000);
  const corrected = `T8 ${RUN} [card number removed]`;
  const reason = `pii ${RUN}`;
  const mod = await call(M, "moderateMessage", "POST", { messageId: secretId, action: "corrected", reason, body: corrected });
  check("T8", "manager corrects a message", mod.ok, mod.error ?? "");
  check("T8", "original kept in messages; overlay persisted", one(`select (m.body='${q(secret)}')||'/'||mm.action from messages m join chat_message_moderation mm on mm.message_id=m.id where m.id='${secretId}'`) === "true/corrected");
  check("T8", "audit chat.message.corrected with reason", one(`select count(*) from audit_logs where action='chat.message.corrected' and entity_id='${secretId}' and metadata->>'reason'='${q(reason)}'`) === "1");
  check("T8", "customer sees the correction live", await sees(customer.page, `[card number removed]`, 25_000));
  const cMsgs = await call(C, "getUserChatMessages", "GET", { conversationId: CONV, limit: 200 });
  const raw = JSON.stringify(cMsgs.value ?? "");
  check("T8", "customer payload never contains the original or the reason", cMsgs.ok && !raw.includes("4111 1111") && !raw.includes(reason) && raw.includes("[card number removed]"));
  const hide = await call(M, "moderateMessage", "POST", { messageId: secretId, action: "hidden", reason });
  check("T8", "manager hides the message", hide.ok, hide.error ?? "");
  await sleep(4000);
  const cMsgs2 = await call(C, "getUserChatMessages", "GET", { conversationId: CONV, limit: 200 });
  check("T8", "hidden message removed from the customer's history", cMsgs2.ok && !JSON.stringify(cMsgs2.value).includes(secretId));
  check("T8", "Chat Manager transcript still holds the original", JSON.stringify((await call(M, "getConversationTranscript", "GET", { conversationId: CONV, limit: 100 })).value ?? "").includes("4111 1111"));

  // ---------------------------------------------------------------- TEST 9
  await customer.context.setOffline(true);
  const t9off = `T9 ${RUN} sent while the customer was offline`;
  await call(M, "sendChatManagerMessage", "POST", { conversationId: CONV, body: t9off });
  const unread = (await call(C, "getUserChatConversations", "GET")).value?.find?.((c) => c.id === CONV)?.unreadCount;
  check("T9", "unread count rises while the customer is away", typeof unread === "number" && unread >= 1, `unread ${unread}`);
  await sleep(2000);
  await customer.context.setOffline(false);
  check("T9", "offline -> online: missed message arrives without reload", await sees(customer.page, `T9 ${RUN} sent while`, 45_000));
  await sleep(4000);
  const unreadAfter = (await call(C, "getUserChatConversations", "GET")).value?.find?.((c) => c.id === CONV)?.unreadCount;
  check("T9", "read state catches up once the customer has seen it", unreadAfter === 0, `unread ${unreadAfter}`);
  for (let i = 1; i <= 6; i++) await say(customer.page, `T9 ${RUN} rapid ${i}`);
  await until(async () => msgCount(CONV, `T9 ${RUN} rapid %`) === 6, 60_000);
  const order = rows(`select body from messages where conversation_id='${CONV}' and body like 'T9 ${RUN} rapid %' order by created_at, id`).map((r) => r[0]);
  check("T9", "six rapid messages stored once each, in typed order", order.length === 6 && order.every((b, i) => b.endsWith(`rapid ${i + 1}`)), order.map((b) => b.slice(-1)).join(""));
  const mgrTr = await call(M, "getConversationTranscript", "GET", { conversationId: CONV, limit: 100 });
  const seq = (mgrTr.value ?? []).filter((m) => m.body?.includes(`T9 ${RUN} rapid`)).map((m) => m.body.slice(-1)).join("");
  check("T9", "manager transcript: same order, no duplicates", seq === "123456", seq);
  await customer.page.reload();
  await customer.page.waitForTimeout(4000);
  await customer.page.getByText("Software Vala Support").first().click().catch(() => {});
  await customer.page.waitForTimeout(3000);
  const domCount = await customer.page.locator("[data-message-id]").filter({ hasText: `T9 ${RUN} rapid 3` }).count();
  check("T9", "after reload: history intact, no duplicate bubbles", domCount === 1, `rapid 3 shown ${domCount}x`);

  // --------------------------------------------------------------- TEST 10
  const sec = [
    ["getChatManagerQueue", "GET", { filters: {} }],
    ["getChatOverview", "GET", undefined],
    ["getConversationTranscript", "GET", { conversationId: CONV, limit: 10 }],
    ["updateConversationControls", "POST", { conversationId: CONV, status: "closed" }],
    ["updateConversationControls", "POST", { conversationId: CONV, assignedAgentId: C.id }],
    ["resolveHandoff", "POST", { handoffId: handoff ?? randomUUID(), status: "rejected" }],
    ["moderateMessage", "POST", { messageId: hindiId, action: "hidden", reason: "x" }],
    ["updateChatManagerParticipant", "POST", { conversationId: CONV, userId: O.id, action: "add" }],
    ["getChatAiGovernance", "GET", undefined],
    ["setRolePermission", "POST", { role: "admin", permission: "chat.export", enabled: false }],
    ["sendChatManagerMessage", "POST", { conversationId: CONV, body: "x" }],
  ];
  for (const [name, method, data] of sec) {
    const r = await call(C, name, method, data);
    check("T10", `customer refused: ${name}${data?.status ? ` (${data.status})` : data?.assignedAgentId ? " (assign)" : ""}`, !r.ok, r.error ?? "ALLOWED");
  }
  const dir = await call(C, "searchUserChatDirectory", "GET", { term: "" });
  check("T10", "customer cannot list platform users", dir.ok && Array.isArray(dir.value) && dir.value.length === 0, `${dir.value?.length} profiles`);
  for (const [name, method, data] of [
    ["getUserChatMessages", "GET", { conversationId: CONV, limit: 10 }],
    ["sendUserChatMessage", "POST", { conversationId: CONV, body: "intrude", clientRef: `x-${RUN}` }],
    ["translateUserChatMessages", "POST", { conversationId: CONV, messageIds: [hindiId], target: "en" }],
    ["getChatManagerQueue", "GET", { filters: {} }],
    ["moderateMessage", "POST", { messageId: hindiId, action: "hidden", reason: "x" }],
  ]) {
    const r = await call(O, name, method, data);
    check("T10", `outsider refused: ${name}`, !r.ok, r.error ?? "ALLOWED");
  }
  check("T10", "no outsider message was written", msgCount(CONV, "intrude") === 0);
  check("T10", "manager-only status unchanged by the customer attempt", one(`select status from conversations where id='${CONV}'`) !== "closed");
  const okQ = await call(M, "getChatManagerQueue", "GET", { filters: { q: RUN } });
  check("T10", "manager authorized: queue", okQ.ok && okQ.value.rows.some((r) => r.id === CONV));
  const okS = await call(M, "updateConversationControls", "POST", { conversationId: CONV, priority: "urgent" });
  check("T10", "manager authorized: priority change", okS.ok && one(`select priority from conversations where id='${CONV}'`) === "urgent");
  // Outsider's own conversation: the customer's stream must not hear it; the manager's must.
  const o = await call(O, "openSupportConversation", "POST");
  if (o.ok) created.add(o.value.conversationId);
  const cHear = listen(C, 12_000);
  const mHear = listen(M, 12_000);
  await sleep(2500);
  const oMsg = await call(O, "sendUserChatMessage", "POST", { conversationId: o.value?.conversationId, body: `T10 ${RUN} outsider own chat`, clientRef: `o-${RUN}` });
  const [ch, mh] = await Promise.all([cHear, mHear]);
  check("T10", "outsider's own conversation works", o.ok && oMsg.ok, o.error ?? oMsg.error ?? "");
  check("T10", "customer stream never receives another customer's events", !ch.some((e) => e.conversation_id === o.value?.conversationId), `${ch.length} events`);
  check("T10", "manager stream receives it (manager channel)", mh.some((e) => e.conversation_id === o.value?.conversationId), `${mh.length} events`);
  check("T10", "customer cannot read the outsider's conversation", !(await call(C, "getUserChatMessages", "GET", { conversationId: o.value?.conversationId, limit: 5 })).ok);

  // Closed conversation: the next support request starts a new conversation.
  await call(M, "updateConversationControls", "POST", { conversationId: CONV, status: "resolved" });
  const again = await call(C, "openSupportConversation", "POST");
  if (again.ok) created.add(again.value.conversationId);
  check("setup", "after resolution the customer gets a new conversation, not a dead end", again.ok && again.value.conversationId !== CONV && again.value.created === true);
  const dup = await call(C, "openSupportConversation", "POST");
  check("setup", "a second request returns the same open conversation (no duplicates)", dup.ok && dup.value.conversationId === again.value?.conversationId);
} catch (error) {
  failed += 1;
  console.log(`  FAIL  the run stopped: ${error instanceof Error ? error.stack?.slice(0, 900) : error}`);
} finally {
  for (const b of browsers) await b.close().catch(() => {});
  const ids = [...created].map((c) => `'${c}'`).join(",");
  console.log(`\nDB summary for run ${RUN}:`);
  try {
    if (ids) {
      for (const r of rows(`select c.id, c.status, c.priority, c.ai_enabled, (select count(*) from messages m where m.conversation_id=c.id) msgs, (select count(*) from chat_message_translations t join messages m on m.id=t.message_id where m.conversation_id=c.id) tr, (select count(*) from message_attachments a where a.conversation_id=c.id) att, (select count(*) from chat_handoffs h where h.conversation_id=c.id) ho, (select count(*) from chat_ai_events e where e.conversation_id=c.id) ai from conversations c where c.id in (${ids})`))
        console.log("  conversation", r.join(" | "));
      console.log("  audit entries kept:", one(`select count(*) from audit_logs where occurred_at >= '${auditFrom}' and (entity_id in (${ids.replace(/'/g, "'")}) or action like 'chat.%')`));
    }
  } catch (e) { console.log("  summary failed:", e.message); }
  if (process.env.SV_E2E_KEEP !== "1" && ids) {
    try {
      if (storedPaths.length) {
        const res = await fetch(`${ops.SUPABASE_URL}/storage/v1/object/chat-files`, {
          method: "DELETE",
          headers: { apikey: ops.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${ops.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({ prefixes: storedPaths }),
        });
        console.log("  removed test files from Storage:", res.status);
      }
      sql(`begin;
        alter table messages disable trigger messages_immutable_delete;
        delete from chat_message_moderation where conversation_id in (${ids});
        delete from chat_message_translations where message_id in (select id from messages where conversation_id in (${ids}));
        delete from chat_ai_events where conversation_id in (${ids});
        delete from chat_conversation_links where conversation_id in (${ids});
        delete from message_attachments where conversation_id in (${ids});
        delete from message_receipts where message_id in (select id from messages where conversation_id in (${ids}));
        delete from message_reactions where message_id in (select id from messages where conversation_id in (${ids}));
        delete from message_mentions where message_id in (select id from messages where conversation_id in (${ids}));
        delete from message_bookmarks where message_id in (select id from messages where conversation_id in (${ids}));
        delete from messages where conversation_id in (${ids});
        alter table messages enable trigger messages_immutable_delete;
        delete from chat_handoffs where conversation_id in (${ids});
        delete from conversation_participants where conversation_id in (${ids});
        delete from conversations where id in (${ids});
        commit;`);
      console.log("  test conversations removed:", [...created].length);
    } catch (e) {
      console.log("  CLEANUP FAILED:", e.message.slice(0, 400));
    }
  }
  const byTest = {};
  for (const r of results) (byTest[r.test] ??= []).push(r.ok);
  console.log("\nSummary:");
  for (const [t, oks] of Object.entries(byTest)) console.log(`  ${t.padEnd(6)} ${oks.every(Boolean) ? "PASS" : "FAIL"}  ${oks.filter(Boolean).length}/${oks.length}`);
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failed ? 1 : 0);
}
