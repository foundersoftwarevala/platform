import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { paths, productionDataDirProblem } from "./config.server.ts";
import { ValaError } from "./util.server.ts";

/**
 * Vala AI's own database: one SQLite file opened with Node's built-in driver.
 *
 * The platform's previous database (Supabase) is discontinued, and nothing
 * else in the repository provides one, so Vala AI carries its own. Schema
 * changes are numbered migrations applied once, in order, tracked by
 * `PRAGMA user_version`. Release records and the audit log refuse UPDATE and
 * DELETE at the database level, so "immutable" is enforced, not promised.
 */

type Row = Record<string, unknown>;

export const MIGRATIONS: string[] = [
  /* 1 */ `
  create table people (
    id text primary key,
    email text not null,
    role text not null,
    last_seen_at text not null
  );

  create table projects (
    id text primary key,
    name text not null,
    description text not null default '',
    source_kind text not null check (source_kind in ('git','empty')),
    source_path text,
    status text not null default 'active' check (status in ('active','archived')),
    created_by text not null,
    created_at text not null,
    updated_at text not null
  );

  create table requirements (
    id text primary key,
    project_id text not null references projects(id),
    version integer not null,
    title text not null,
    body text not null,
    acceptance_checks text not null default '[]',
    status text not null check (status in ('draft','approved','superseded')),
    created_by text not null,
    created_at text not null,
    approved_by text,
    approved_at text,
    unique (project_id, version)
  );

  create table change_requests (
    id text primary key,
    project_id text not null references projects(id),
    requirement_id text not null references requirements(id),
    reason text not null,
    proposed_title text not null,
    proposed_body text not null,
    proposed_checks text not null,
    status text not null default 'open' check (status in ('open','approved','rejected')),
    raised_by text not null,
    created_at text not null,
    decided_by text,
    decided_at text
  );

  create table workspaces (
    id text primary key,
    project_id text not null unique references projects(id),
    path text not null,
    base_commit text,
    status text not null check (status in ('creating','ready','failed')),
    error text,
    created_at text not null
  );

  create table tasks (
    id text primary key,
    project_id text not null references projects(id),
    requirement_id text not null references requirements(id),
    title text not null,
    instruction text not null,
    state text not null,
    fix_loops integer not null default 0,
    max_fix_loops integer not null,
    lease_owner text,
    lease_until text,
    cancel_requested integer not null default 0,
    blocked_reason text,
    error text,
    plan_json text,
    result_summary text,
    start_commit text,
    bytes_written integer not null default 0,
    created_by text not null,
    created_at text not null,
    updated_at text not null,
    started_at text,
    finished_at text
  );
  create index tasks_state on tasks(state);

  create table task_events (
    id integer primary key autoincrement,
    task_id text not null references tasks(id),
    at text not null,
    kind text not null,
    from_state text,
    to_state text,
    message text not null,
    data_json text
  );
  create index task_events_task on task_events(task_id, id);

  create table checkpoints (
    id text primary key,
    task_id text references tasks(id),
    project_id text not null references projects(id),
    label text not null,
    commit_sha text not null,
    created_at text not null
  );

  create table evidence (
    id text primary key,
    task_id text references tasks(id),
    project_id text not null references projects(id),
    check_id text,
    label text not null,
    command text not null,
    commit_sha text,
    exit_code integer,
    timed_out integer not null default 0,
    duration_ms integer not null,
    output_path text not null,
    output_sha256 text not null,
    output_tail text not null,
    producer text not null check (producer in ('agent','verifier')),
    verdict text not null check (verdict in ('pass','fail','unknown')),
    created_at text not null
  );

  create table approvals (
    id text primary key,
    kind text not null,
    project_id text references projects(id),
    target_id text not null,
    scope_json text not null,
    status text not null check (status in ('pending','approved','rejected','executed','failed')),
    requested_by text not null,
    requested_at text not null,
    decided_by text,
    decided_at text,
    decision_note text,
    evidence_reviewed text,
    outcome text
  );

  create table releases (
    id text primary key,
    project_id text not null references projects(id),
    task_id text not null references tasks(id),
    label text not null,
    base_commit text not null,
    commit_sha text not null,
    patch_path text not null,
    patch_sha256 text not null,
    evidence_ids text not null,
    approval_id text not null,
    created_by text not null,
    created_at text not null
  );
  create trigger releases_no_update before update on releases begin select raise(abort, 'releases are immutable'); end;
  create trigger releases_no_delete before delete on releases begin select raise(abort, 'releases are immutable'); end;

  create table chat_messages (
    id text primary key,
    project_id text references projects(id),
    operator_id text not null,
    role text not null check (role in ('user','assistant','error')),
    content text not null,
    model text,
    duration_ms integer,
    tokens_in integer,
    tokens_out integer,
    created_at text not null
  );
  create index chat_messages_project on chat_messages(project_id, created_at);

  create table audit_log (
    seq integer primary key autoincrement,
    at text not null,
    actor text not null,
    action text not null,
    target_type text,
    target_id text,
    detail_json text not null,
    prev_hash text not null,
    hash text not null
  );
  create trigger audit_no_update before update on audit_log begin select raise(abort, 'audit log is append-only'); end;
  create trigger audit_no_delete before delete on audit_log begin select raise(abort, 'audit log is append-only'); end;

  create table settings (
    key text primary key,
    value_json text not null,
    updated_at text not null,
    updated_by text not null
  );
  `,
  /* 2: indexes for the lookups the screens make on every refresh */ `
  create index if not exists evidence_task on evidence(task_id, created_at);
  create index if not exists approvals_status on approvals(status, requested_at);
  create index if not exists releases_project on releases(project_id, created_at);
  `,
  /* 3: where each check ran, and the workspace git configuration Vala AI created */ `
  alter table evidence add column sandbox text not null default 'none';
  alter table workspaces add column git_config_sha256 text;
  `,
];

let instance: { path: string; db: DatabaseSync } | null = null;

export function db(): DatabaseSync {
  const problem = productionDataDirProblem();
  if (problem) throw new ValaError(503, `Vala AI is not configured: ${problem}`);
  const file = paths.db();
  if (instance && instance.path === file) return instance.db;
  mkdirSync(dirname(file), { recursive: true });
  const handle = new DatabaseSync(file);
  handle.exec("pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000;");
  migrate(handle);
  instance = { path: file, db: handle };
  return handle;
}

/** For tests: drop the cached handle so the next call opens `VALA_AI_DATA_DIR` afresh. */
export function closeDb() {
  instance?.db.close();
  instance = null;
}

function migrate(handle: DatabaseSync) {
  const current = Number((handle.prepare("pragma user_version").get() as Row).user_version ?? 0);
  for (let i = current; i < MIGRATIONS.length; i++) {
    handle.exec("begin immediate");
    try {
      handle.exec(MIGRATIONS[i]);
      handle.exec(`pragma user_version = ${i + 1}`);
      handle.exec("commit");
    } catch (error) {
      handle.exec("rollback");
      throw error;
    }
  }
}

export function schemaVersion(): number {
  return Number((db().prepare("pragma user_version").get() as Row).user_version ?? 0);
}

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return db()
    .prepare(sql)
    .all(...(params as never[])) as T[];
}

export function one<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return db()
    .prepare(sql)
    .get(...(params as never[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]) {
  return db()
    .prepare(sql)
    .run(...(params as never[]));
}

export function tx<T>(fn: () => T): T {
  const handle = db();
  handle.exec("begin immediate");
  try {
    const out = fn();
    handle.exec("commit");
    return out;
  } catch (error) {
    handle.exec("rollback");
    throw error;
  }
}
