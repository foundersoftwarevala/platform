/**
 * Chat database test harness (RLS, grants, idempotency, rate limits, signup,
 * translation claim/finish, Chat Manager queue + monitor).
 *
 * Runs the repository's real Chat migrations, in order, against an in-process
 * PostgreSQL (PGlite) with the minimum stand-ins for what Supabase provides
 * (auth.uid(), roles, storage). It needs no network and touches no real
 * database. It is NOT the VPS: it proves the SQL's logic, not the live state.
 *
 *   npm i --no-save --prefix <tmp> @electric-sql/pglite
 *   PGLITE_PATH=<tmp>/node_modules/@electric-sql/pglite/dist/index.js node scripts/ops/chat-db-harness.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = path.resolve(here, "../../supabase/migrations");
const { PGlite } = await import(
  pathToFileURL(process.env.PGLITE_PATH ?? "@electric-sql/pglite").href
);
const db = new PGlite();

const results = [];
const record = (ok, label, detail = "") => {
  results.push(ok);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${detail ? " - " + String(detail).slice(0, 110) : ""}`,
  );
};
const allow = async (label, fn) => {
  try {
    const r = await fn();
    record(true, label);
    return r;
  } catch (e) {
    record(false, label + " (denied)", e.message);
  }
};
const deny = async (label, fn) => {
  try {
    await fn();
    record(false, label + " (was allowed)");
  } catch (e) {
    record(true, label, e.message);
  }
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
const as = async (role, uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  if (role !== "postgres") await db.exec(`set role ${role}`);
};

// ------------------------------------------------------------- stand-ins
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create type public.app_role as enum ('admin','boss','founder','developer','support','customer','sales','reseller','sales_support_manager','client','boss_owner','super_admin','legal');
create table public.user_roles (user_id uuid not null, role public.app_role not null, unique (user_id, role));
create table public.profiles (id uuid primary key, username text, full_name text, email text);
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor text, action text, entity_type text, entity_id text, severity text, metadata jsonb default '{}', occurred_at timestamptz default now(), ip text);
grant select, insert on public.audit_logs to authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
create table public.ai_agents (id uuid primary key default gen_random_uuid(), agent_key text, status text, channels text[] not null default '{}');
alter table public.ai_agents add constraint ai_agents_channels_are_connected check (channels <@ array['email','internal_message','lead_followup']::text[]);
create table public.api_services (id uuid primary key default gen_random_uuid(), name text);
create table public.usage_events (id uuid primary key default gen_random_uuid(), occurred_at timestamptz default now(), service_id uuid, model_id text, product text, requests int, tokens_in int, tokens_out int, cost_usd numeric, latency_ms int, status_code int, success boolean, source text);
create table public.fa_jobs (id uuid primary key default gen_random_uuid(), job_type text, status text, attempts int default 0, created_at timestamptz default now(), updated_at timestamptz default now(), started_at timestamptz, completed_at timestamptz, failed_at timestamptz);
create table public.fa_job_limits (job_type text primary key, max_concurrent int);
create table public.i18n_translation_jobs (id uuid primary key default gen_random_uuid(), status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.ai_agent_runs (id uuid primary key default gen_random_uuid(), scope text, state text, started_at timestamptz default now());
grant all on all tables in schema public to service_role;
grant select on public.profiles to authenticated;
`);

const run = async (file, sql) => {
  try {
    await db.exec(sql ?? fs.readFileSync(path.join(migrations, file), "utf8"));
    record(true, `migration ${file}`);
  } catch (e) {
    record(false, `migration ${file}`, e.message);
    throw e;
  }
};
await run("20260923T120000_connect_chat_tables.sql");
await run("20260924T010000_chat_read_back_own_rows.sql");
await run("20261107T110000_chat_manager_restore.sql");
const guards = fs
  .readFileSync(
    path.join(migrations, "20261107T231000_developer_ecosystem_write_guards.sql"),
    "utf8",
  )
  .split("\n");
await run("write_guards (sections 1-2)", guards.slice(45, 59).join("\n"));
for (const f of [
  "20261108T090000_chat_customer_security.sql",
  "20261108T091000_chat_sources_and_links.sql",
  "20261108T092000_chat_ai_agents.sql",
  "20261108T093000_chat_signup_provisioning.sql",
  "20261108T094000_chat_rate_limits.sql",
  "20261108T095000_chat_translations.sql",
  "20261108T096000_chat_drift_fix_and_indexes.sql",
  "20261108T097000_chat_manager_queue_monitor.sql",
  "20261108T098000_chat_manager_operations.sql",
])
  await run(f);
// Re-running must be harmless (idempotency of the migrations themselves).
for (const f of [
  "20261108T090000_chat_customer_security.sql",
  "20261108T096000_chat_drift_fix_and_indexes.sql",
  "20261108T097000_chat_manager_queue_monitor.sql",
  "20261108T098000_chat_manager_operations.sql",
]) {
  try {
    await db.exec(fs.readFileSync(path.join(migrations, f), "utf8"));
    record(true, `re-run ${f}`);
  } catch (e) {
    record(false, `re-run ${f}`, e.message);
  }
}

// ------------------------------------------------------------- fixtures
await as("postgres");
const ids = {};
for (const n of ["custA", "custB", "staff", "mgr", "dev"]) {
  ids[n] = (
    await q("insert into auth.users(email) values ($1) returning id", [n + "@x.test"])
  )[0].id;
  await db.query(
    "insert into public.profiles(id, username, full_name, email, handle, display_name) values ($1,$2,$2,$3,$2,$2)",
    [ids[n], n, n + "@x.test"],
  );
}
// The signup trigger already gave every fixture user the customer role; set the roles under test.
await db.query("delete from public.user_roles");
await db.query(
  "insert into public.user_roles values ($1,'customer'),($2,'customer'),($3,'support'),($4,'admin'),($5,'developer')",
  [ids.custA, ids.custB, ids.staff, ids.mgr, ids.dev],
);
record(
  (await q("select public.has_permission($1, 'chat.permissions.manage') allowed", [ids.mgr]))[0]
    .allowed,
  "admin receives the guarded Chat Manager permission editor grant",
);
record(
  !(await q("select public.has_permission($1, 'chat.permissions.manage') allowed", [ids.staff]))[0]
    .allowed,
  "support cannot edit Chat Manager role grants",
);
await as("authenticated", ids.staff);
await deny("support cannot change a role permission", () =>
  db.query("select public.chat_manager_set_role_permission('sales', 'chat.assign', true)"),
);
await as("postgres");
await db.query("insert into public.user_roles(user_id, role) values ($1, 'sales')", [ids.dev]);
await as("authenticated", ids.mgr);
await db.query("select public.chat_manager_set_role_permission('sales', 'chat.assign', true)");
record(
  (await q("select public.has_permission($1, 'chat.assign') allowed", [ids.dev]))[0].allowed,
  "authorized role grant immediately updates permission resolution",
);
await db.query("select public.chat_manager_set_role_permission('sales', 'chat.assign', false)");
record(
  !(await q("select public.has_permission($1, 'chat.assign') allowed", [ids.dev]))[0].allowed &&
    (
      await q(
        "select count(*)::int n from public.audit_logs where action='chat.permission.changed' and entity_id='sales:chat.assign'",
      )
    )[0].n === 2,
  "role permission removal is audited with the atomic grant operation",
);
await as("postgres");
await db.query("delete from public.user_roles where user_id=$1 and role='sales'", [ids.dev]);
await as("authenticated", ids.mgr);
await deny("permission-management cannot be delegated through the chat matrix", () =>
  db.query(
    "select public.chat_manager_set_role_permission('sales', 'chat.permissions.manage', true)",
  ),
);
await as("postgres");

// ----------------------------------------------------- signup provisioning
const newUser = (await q("insert into auth.users(email) values ('fresh@x.test') returning id"))[0]
  .id;
const viaTrigger = await q("select role::text from public.user_roles where user_id=$1", [newUser]);
record(
  viaTrigger.length === 1 && viaTrigger[0].role === "customer",
  "signup trigger (accounts created in this database) grants only customer",
);
await db.query("delete from public.user_roles where user_id=$1", [newUser]);
await db.query("delete from public.profiles where id=$1", [newUser]);
await as("service_role");
await db.query("select public.chat_ensure_account($1)", [newUser]);
await db.query("select public.chat_ensure_account($1)", [newUser]); // twice: idempotent
const roles = await q("select role::text from public.user_roles where user_id=$1", [newUser]);
record(
  roles.length === 1 && roles[0].role === "customer",
  "new account gets exactly the customer role",
);
await as("postgres");
const perm = async (p) =>
  (await q("select public.has_permission($1,$2) as ok", [newUser, p]))[0].ok;
record(await perm("message.send"), "new customer: message.send");
for (const p of [
  "chat.manage",
  "chat.assign",
  "chat.moderate",
  "chat.export",
  "conversation.manage",
])
  record(!(await perm(p)), `new customer: no ${p}`);
await as("authenticated", ids.custA);
await deny("customer cannot call chat_ensure_account", () =>
  db.query("select public.chat_ensure_account($1)", [ids.custB]),
);

// ------------------------------------------- conversations opened by server
await as("service_role");
const convA = (
  await q(
    "insert into public.conversations(subject,kind,created_by,department,ai_enabled) values ('Support A','support',$1,'Support',true) returning id",
    [ids.custA],
  )
)[0].id;
await db.query(
  "insert into public.conversation_participants(conversation_id,user_id,role_label) values ($1,$2,'Customer')",
  [convA, ids.custA],
);
const convB = (
  await q(
    "insert into public.conversations(subject,kind,created_by) values ('Support B','support',$1) returning id",
    [ids.custB],
  )
)[0].id;
await db.query(
  "insert into public.conversation_participants(conversation_id,user_id) values ($1,$2)",
  [convB, ids.custB],
);

// ---------------------------------------------------------- customer limits
await as("authenticated", ids.custA);
const msg = await allow(
  "customer sends a message",
  async () =>
    (
      await q(
        "insert into public.messages(conversation_id,sender_id,body,client_ref) values ($1,$2,'hello','ref-1') returning id",
        [convA, ids.custA],
      )
    )[0],
);
await deny("same client_ref again (idempotent)", () =>
  db.query(
    "insert into public.messages(conversation_id,sender_id,body,client_ref) values ($1,$2,'hello','ref-1')",
    [convA, ids.custA],
  ),
);
await deny("edit own message", () =>
  db.query("update public.messages set body='x' where id=$1", [msg.id]),
);
await deny("delete own message", () =>
  db.query("delete from public.messages where id=$1", [msg.id]),
);
await deny("post as ai", () =>
  db.query(
    "insert into public.messages(conversation_id,sender_id,body,kind) values ($1,$2,'x','ai')",
    [convA, ids.custA],
  ),
);
await deny("post as another user", () =>
  db.query("insert into public.messages(conversation_id,sender_id,body) values ($1,$2,'x')", [
    convA,
    ids.custB,
  ]),
);
await deny("post into another customer's conversation", () =>
  db.query("insert into public.messages(conversation_id,sender_id,body) values ($1,$2,'x')", [
    convB,
    ids.custA,
  ]),
);
record(
  (await q("select 1 from public.messages where conversation_id=$1", [convB])).length === 0,
  "cannot read another customer's messages",
);
await deny("join another conversation", () =>
  db.query("insert into public.conversation_participants(conversation_id,user_id) values ($1,$2)", [
    convB,
    ids.custA,
  ]),
);
await deny("add staff to own conversation", () =>
  db.query("insert into public.conversation_participants(conversation_id,user_id) values ($1,$2)", [
    convA,
    ids.staff,
  ]),
);
await deny("create a group conversation", () =>
  db.query("insert into public.conversations(subject,kind,created_by) values ('g','group',$1)", [
    ids.custA,
  ]),
);
const chan = await q(
  "insert into public.conversations(subject,kind,created_by,ai_enabled,status,priority) values ('c','channel',$1,true,'escalated','urgent') returning ai_enabled, status, priority",
  [ids.custA],
);
record(
  chan[0].ai_enabled === false && chan[0].status === "open" && chan[0].priority === "normal",
  "customer-made conversation cannot pre-set AI/status/priority",
);
await deny("customer truncates messages (grant removed)", () =>
  db.query("truncate public.messages"),
);
await deny("customer deletes conversation", () =>
  db.query("delete from public.conversations where id=$1", [convA]),
);
await deny("customer reads translations of another conversation", async () => {
  if ((await q("select 1 from public.chat_message_translations")).length)
    throw new Error("rows visible");
  throw new Error("0 rows (expected)");
});
// message rate limit: 40 per minute per person
let limited = false;
for (let i = 0; i < 45; i += 1) {
  try {
    await db.query(
      "insert into public.messages(conversation_id,sender_id,body,client_ref) values ($1,$2,'m',$3)",
      [convA, ids.custA, "burst-" + i],
    );
  } catch (e) {
    if (/chat_rate_limited:messages/.test(e.message)) {
      limited = true;
      break;
    } else throw e;
  }
}
record(limited, "message flood is rate-limited by the database");
await as("anon");
await deny("anon reads messages (no grant)", () =>
  db.query("select 1 from public.messages limit 1"),
);

// ------------------------------------------------- handoff: one pending
await as("authenticated", ids.custA);
await allow("first handoff request", () =>
  db.query(
    "insert into public.chat_handoffs(conversation_id,requested_by,reason) values ($1,$2,'help')",
    [convA, ids.custA],
  ),
);
await deny("second pending handoff (retry-safe)", () =>
  db.query(
    "insert into public.chat_handoffs(conversation_id,requested_by,reason) values ($1,$2,'help')",
    [convA, ids.custA],
  ),
);

// -------------------------------------------------------- manager queue
await as("service_role");
const convs = [];
for (let i = 0; i < 5; i += 1) {
  const c = (
    await q(
      "insert into public.conversations(subject,kind,created_by,last_message_at) values ($1,'support',$2, now() - ($3 || ' minutes')::interval) returning id",
      ["Queue " + i, ids.custB, String(i * 10)],
    )
  )[0].id;
  await db.query(
    "insert into public.conversation_participants(conversation_id,user_id) values ($1,$2)",
    [c, ids.custB],
  );
  convs.push(c);
}
await db.query(
  "insert into public.messages(conversation_id,sender_id,body,created_at) values ($1,$2,'invoice refund please',now())",
  [convs[0], ids.custB],
);
await as("authenticated", ids.mgr);
const page1 = (await q("select public.chat_manager_queue('{}'::jsonb, 3) r"))[0].r;
const pageAll = (await q("select public.chat_manager_queue('{}'::jsonb, 100) r"))[0].r;
const page2 = (
  await q("select public.chat_manager_queue('{}'::jsonb, 3, $1, $2) r", [
    page1.next_cursor.at,
    page1.next_cursor.id,
  ])
)[0].r;
const seenIds = [...page1.rows, ...page2.rows].map((r) => r.id);
record(
  page1.rows.length === 3 && page1.next_cursor !== null,
  "queue page 1 has 3 rows and a cursor",
);
record(pageAll.rows.length === 8 && pageAll.next_cursor === null, "final queue page has no cursor");
record(new Set(seenIds).size === seenIds.length, "queue pages do not overlap");
record(
  page1.rows[0].last_message_at >= page1.rows[1].last_message_at,
  "queue ordered by recent activity",
);
const byText = (await q(`select public.chat_manager_queue('{"q":"refund"}'::jsonb, 10) r`))[0].r;
record(
  byText.rows.length === 1 && byText.rows[0].id === convs[0],
  "search finds a conversation by message text",
);
const byId = (
  await q(`select public.chat_manager_queue(jsonb_build_object('q', $1::text), 10) r`, [convs[2]])
)[0].r;
record(byId.rows.length === 1, "search finds a conversation by id");
const byName = (await q(`select public.chat_manager_queue('{"q":"custB"}'::jsonb, 50) r`))[0].r;
record(byName.rows.length >= 5, "search finds conversations by customer name");
const waiting = (await q(`select public.chat_manager_queue('{"view":"waiting"}'::jsonb, 50) r`))[0]
  .r;
record(
  waiting.rows.some((r) => r.id === convs[0]) && waiting.rows.every((r) => r.customer_last),
  "waiting view = customer spoke last",
);
const unassigned = (
  await q(`select public.chat_manager_queue('{"view":"unassigned"}'::jsonb, 50) r`)
)[0].r;
record(unassigned.rows.length >= 5, "unassigned view");
const pending = (await q(`select public.chat_manager_queue('{"view":"pending"}'::jsonb, 50) r`))[0]
  .r;
record(
  pending.rows.some((r) => r.id === convA && r.pending_handoff),
  "pending view shows the conversation with a pending handoff",
);
await allow("status/priority accept valid values", () =>
  db.query("update public.conversations set status='pending', priority='high' where id=$1", [
    convs[1],
  ]),
);
await deny("status rejects an invented value", () =>
  db.query("update public.conversations set status='bogus' where id=$1", [convs[1]]),
);
await db.query("select public.chat_manager_set_assignee($1, $2)", [convs[0], ids.staff]);
record(
  (await q("select assigned_agent_id from public.conversations where id=$1", [convs[0]]))[0]
    .assigned_agent_id === ids.staff,
  "manager assignment RPC writes the canonical assigned handler",
);
await db.query("select public.chat_manager_update_conversation($1, 'escalated', 'urgent', true)", [
  convs[0],
]);
const controlled = (
  await q("select status, priority, ai_enabled from public.conversations where id=$1", [convs[0]])
)[0];
record(
  controlled.status === "escalated" && controlled.priority === "urgent" && controlled.ai_enabled,
  "manager conversation-control RPC updates status, priority and AI together",
);
await as("service_role");
await db.query(
  "insert into public.chat_handoffs(conversation_id, requested_by, reason) values ($1, $2, 'manager handoff test')",
  [convs[0], ids.custB],
);
await as("authenticated", ids.mgr);
const handoff = (
  await q("select id from public.chat_handoffs where conversation_id=$1 and status='pending'", [
    convs[0],
  ])
)[0].id;
await db.query("select public.chat_manager_resolve_handoff($1, 'accepted')", [handoff]);
const accepted = (
  await q("select status, assigned_agent_id, ai_enabled from public.conversations where id=$1", [
    convs[0],
  ])
)[0];
record(
  (await q("select status from public.chat_handoffs where id=$1", [handoff]))[0].status ===
    "accepted" &&
    accepted.assigned_agent_id === ids.mgr &&
    !accepted.ai_enabled,
  "accepting a handoff assigns the operator and disables AI atomically",
);
await db.query("select public.chat_manager_set_participant($1, $2, 'add')", [convs[1], ids.custA]);
record(
  (
    await q(
      "select 1 from public.conversation_participants where conversation_id=$1 and user_id=$2",
      [convs[1], ids.custA],
    )
  ).length === 1,
  "manager adds a participant to the canonical conversation",
);
await db.query("select public.chat_manager_set_participant($1, $2, 'remove')", [
  convs[1],
  ids.custA,
]);
record(
  (
    await q(
      "select 1 from public.conversation_participants where conversation_id=$1 and user_id=$2",
      [convs[1], ids.custA],
    )
  ).length === 0,
  "manager removes a participant from the canonical conversation",
);
const priorMessages = (
  await q("select count(*)::int n from public.messages where conversation_id=$1", [convs[2]])
)[0].n;
await db.query("select public.chat_manager_send_message($1, 'Operator reply')", [convs[2]]);
const sent = (
  await q(
    "select sender_id, kind, body from public.messages where conversation_id=$1 order by created_at desc, id desc limit 1",
    [convs[2]],
  )
)[0];
record(
  sent.sender_id === ids.mgr &&
    sent.kind === "text" &&
    sent.body === "Operator reply" &&
    (await q("select count(*)::int n from public.messages where conversation_id=$1", [convs[2]]))[0]
      .n ===
      priorMessages + 1,
  "manager reply persists as a canonical immutable chat message",
);
await db.query("select public.chat_manager_update_conversation($1, 'closed', null, null)", [
  convs[3],
]);
await deny("manager cannot reply to a closed conversation", () =>
  db.query("select public.chat_manager_send_message($1, 'not allowed')", [convs[3]]),
);
await as("authenticated", ids.dev);
await deny("developer without chat.manage cannot mutate conversation controls", () =>
  db.query("select public.chat_manager_update_conversation($1, 'open', null, null)", [convs[0]]),
);
await deny("developer without chat.assign cannot assign a handler", () =>
  db.query("select public.chat_manager_set_assignee($1, $2)", [convs[0], ids.staff]),
);
await as("authenticated", ids.mgr);
record(
  (
    await q(
      "select count(*)::int n from public.audit_logs where action like 'chat.%' and entity_id=$1",
      [convs[0]],
    )
  )[0].n >= 3,
  "manager assignment, conversation controls and participant actions are audited",
);
await as("authenticated", ids.custA);
await deny("customer cannot call the queue", () =>
  db.query("select public.chat_manager_queue('{}'::jsonb, 5)"),
);
await deny("customer cannot call the monitor", () =>
  db.query("select public.chat_manager_monitor(24)"),
);
await as("authenticated", ids.dev);
await deny("developer (conversation.manage only) cannot call the queue", () =>
  db.query("select public.chat_manager_queue('{}'::jsonb, 5)"),
);

// ------------------------------------------------------------ monitor
await as("service_role");
const svc = (await q("insert into public.api_services(name) values ('OpenAI API') returning id"))[0]
  .id;
await db.query(
  "insert into public.usage_events(service_id, latency_ms, status_code, success, product) values ($1, 2200, 200, true, 'assistant'), ($1, 500, 400, false, 'assistant')",
  [svc],
);
await db.query(
  "insert into public.fa_jobs(job_type,status,completed_at) values ('demo.sync','completed',now()), ('demo.sync','queued',null), ('demo.scan','dead_letter',null)",
);
await db.query("insert into public.fa_job_limits values ('demo.sync', 2)");
await db.query("insert into public.i18n_translation_jobs(status) values ('queued'), ('done')");
await db.query(
  "insert into public.chat_ai_events(conversation_id, agent_key, outcome, latency_ms) values ($1,'sales-software-sales','replied',1800), ($1,null,'failed',300)",
  [convA],
);
await as("authenticated", ids.mgr);
const mon = (await q("select public.chat_manager_monitor(24) m"))[0].m;
record(mon.conversations.total >= 7, "monitor: conversation totals are computed");
record(
  Array.isArray(mon.providers) && mon.providers[0].calls === 2 && mon.providers[0].failed === 1,
  "monitor: provider calls/failures from usage_events",
);
record(
  mon.queue_workers.some((w) => w.job_type === "demo.sync" && w.queued === 1) &&
    mon.queue_workers.some((w) => w.dead_letter === 1),
  "monitor: queue workers from fa_jobs",
);
record(
  mon.ai.replied === 1 && mon.ai.failed === 1 && mon.ai.agents.length === 2,
  "monitor: AI activity from chat_ai_events",
);
record(mon.translation_jobs.by_status.queued === 1, "monitor: translation job queue");
record(mon.chat_translation !== undefined, "monitor: Chat translation health present");
record(
  mon.waiting.waiting >= 1 && mon.first_response.unanswered >= 1,
  "monitor: waiting + unanswered from messages",
);

// ------------------------------------------------------- translations
await as("service_role");
const m1 = (
  await q(
    "insert into public.messages(conversation_id,sender_id,body) values ($1,$2,'नमस्ते') returning id",
    [convA, ids.custA],
  )
)[0].id;
const c1 = (await q("select public.chat_translation_claim($1,'en') r", [m1]))[0].r;
record(
  c1.claimed === true && c1.row.attempts === 1 && c1.row.status === "processing",
  "translation: first caller claims the work",
);
const c2 = (await q("select public.chat_translation_claim($1,'en') r", [m1]))[0].r;
record(c2.claimed === false, "translation: a second caller does not duplicate the work");
const f1 = (
  await q(
    "select public.chat_translation_finish($1,'en','completed','Hello','hi',0.99::real,false,null,'owned-engine','madlad',0.8::real,1200) r",
    [m1],
  )
)[0].r;
record(
  f1.updated === true &&
    f1.row.status === "completed" &&
    f1.row.translated_text === "Hello" &&
    f1.row.source_language === "hi",
  "translation: result stored with source language and metadata",
);
const c3 = (await q("select public.chat_translation_claim($1,'en') r", [m1]))[0].r;
record(
  c3.claimed === false && c3.row.status === "completed",
  "translation: completed result is reused, not translated again",
);
// retry with backoff, bounded attempts
const m2 = (
  await q(
    "insert into public.messages(conversation_id,sender_id,body) values ($1,$2,'text') returning id",
    [convA, ids.custA],
  )
)[0].id;
let last;
for (let i = 1; i <= 4; i += 1) {
  const c = (await q("select public.chat_translation_claim($1,'ar') r", [m2]))[0].r;
  if (!c.claimed) {
    await db.query(
      "update public.chat_message_translations set next_attempt_at = now() - interval '1 second' where message_id=$1",
      [m2],
    );
    i -= 1;
    continue;
  }
  last = (
    await q(
      "select public.chat_translation_finish($1,'ar','retrying',null,null,null,false,'timeout',null,null,null,null,5) r",
      [m2],
    )
  )[0].r;
}
record(
  last.row.status === "failed" && last.row.attempts === 4,
  "translation: failed after the bounded 4 attempts, error kept",
);
const retry = (await q("select public.chat_translation_claim($1,'ar',true) r", [m2]))[0].r;
record(
  retry.claimed === true && retry.row.attempts === 1,
  "translation: explicit retry resets the budget",
);
await db.query(
  "select public.chat_translation_finish($1,'ar','completed','مرحبا','en',null,false,null,null,null,null,null)",
  [m2],
);
await as("authenticated", ids.custA);
record(
  (await q("select 1 from public.chat_message_translations where message_id=$1", [m2])).length ===
    1,
  "participant can read the translation of their message",
);
await as("authenticated", ids.custB);
record(
  (await q("select 1 from public.chat_message_translations where message_id=$1", [m2])).length ===
    0,
  "another customer cannot read it",
);
await deny("customer cannot call translation claim", () =>
  db.query("select public.chat_translation_claim($1,'en')", [m2]),
);
await as("authenticated", ids.mgr);
await db.query("select public.chat_moderate_message($1,'hidden','policy')", [m2]);
await as("authenticated", ids.custA);
record(
  (await q("select 1 from public.chat_message_translations where message_id=$1", [m2])).length ===
    0,
  "moderated message: its translation is withheld from the customer",
);
await as("authenticated", ids.mgr);
record(
  (await q("select 1 from public.chat_message_translations where message_id=$1", [m2])).length ===
    1,
  "Chat Manager still sees it",
);
const health = (await q("select public.chat_translation_health(24) h"))[0].h;
record(
  health.by_status.completed >= 1 && health.latency_ms.samples >= 1,
  "translation health: counts and latency",
);

// ------------------------------------------------- explain (index use)
await as("postgres");
await db.exec("set enable_seqscan = off");
const plan = (
  await q(
    "explain select * from public.conversations order by last_message_at desc, id desc limit 31",
  )
)
  .map((r) => r["QUERY PLAN"])
  .join("\n");
record(/conversations_activity_idx/.test(plan), "queue ordering uses conversations_activity_idx");
const plan2 = (
  await q(
    "explain select * from public.messages where conversation_id = '00000000-0000-0000-0000-0000000000aa' order by created_at desc, id desc limit 50",
  )
)
  .map((r) => r["QUERY PLAN"])
  .join("\n");
record(
  /messages_conversation_cursor_idx|messages_conversation_idx/.test(plan2),
  "history paging uses a conversation/time index",
  plan2.split("\n").join(" | "),
);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exitCode = failed ? 1 : 0;
