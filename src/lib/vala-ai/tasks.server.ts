import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { audit } from "./audit.server.ts";
import type { Operator } from "./auth.server.ts";
import { paths } from "./config.server.ts";
import { all, one, run } from "./db.server.ts";
import { parseCommand, runCommand, type ExecResult } from "./exec.server.ts";
import { containerName, dockerProblem, sandboxPolicy } from "./sandbox.server.ts";
import {
  approvedRequirement,
  checksOf,
  getProject,
  getRequirement,
  touch,
  type AcceptanceCheck,
} from "./projects.server.ts";
import { getSettings } from "./settings.server.ts";
import { newId, now, sha256, tail, ValaError } from "./util.server.ts";
import { headCommit, requireReadyWorkspace, type Workspace } from "./workspace.server.ts";

/**
 * Durable tasks and the rules for moving between states.
 *
 *   PENDING → ANALYZING → BUILDING → TESTING → (FIXING → RETESTING)* → VERIFIED → COMPLETE
 *
 * plus BLOCKED (waiting on something outside the agent, with a reason),
 * FAILED and CANCELLED. Every transition is checked against the table below
 * and written to task_events, so the history of a task is complete and its
 * current state can always be resumed after a restart.
 */

export const STATES = [
  "PENDING",
  "ANALYZING",
  "BUILDING",
  "TESTING",
  "FIXING",
  "RETESTING",
  "VERIFIED",
  "COMPLETE",
  "BLOCKED",
  "FAILED",
  "CANCELLED",
] as const;
export type TaskState = (typeof STATES)[number];
export const TERMINAL: TaskState[] = ["COMPLETE", "FAILED", "CANCELLED"];
export const ACTIVE: TaskState[] = [
  "PENDING",
  "ANALYZING",
  "BUILDING",
  "TESTING",
  "FIXING",
  "RETESTING",
  "VERIFIED",
];

const EXITS = ["BLOCKED", "FAILED", "CANCELLED"] as const;
export const TRANSITIONS: Record<TaskState, TaskState[]> = {
  PENDING: ["ANALYZING", ...EXITS],
  ANALYZING: ["BUILDING", ...EXITS],
  BUILDING: ["TESTING", ...EXITS],
  TESTING: ["VERIFIED", "FIXING", ...EXITS],
  FIXING: ["RETESTING", ...EXITS],
  RETESTING: ["VERIFIED", "FIXING", ...EXITS],
  VERIFIED: ["COMPLETE", "FAILED"],
  BLOCKED: ["PENDING", "CANCELLED"],
  COMPLETE: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type Task = {
  id: string;
  project_id: string;
  requirement_id: string;
  title: string;
  instruction: string;
  state: TaskState;
  fix_loops: number;
  max_fix_loops: number;
  lease_owner: string | null;
  lease_until: string | null;
  cancel_requested: number;
  blocked_reason: string | null;
  error: string | null;
  plan_json: string | null;
  result_summary: string | null;
  start_commit: string | null;
  bytes_written: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};
export type TaskEvent = {
  id: number;
  task_id: string;
  at: string;
  kind: string;
  from_state: string | null;
  to_state: string | null;
  message: string;
  data_json: string | null;
};
export type Evidence = {
  id: string;
  task_id: string | null;
  project_id: string;
  check_id: string | null;
  label: string;
  command: string;
  commit_sha: string | null;
  exit_code: number | null;
  timed_out: number;
  duration_ms: number;
  output_path: string;
  output_sha256: string;
  output_tail: string;
  producer: "agent" | "verifier";
  verdict: "pass" | "fail" | "unknown";
  /** "none" (ran on this machine), "docker <image>", or "refused" (sandbox required but unavailable). */
  sandbox: string;
  created_at: string;
};

export function getTask(id: string): Task {
  const t = one<Task>("select * from tasks where id = ?", id);
  if (!t) throw new ValaError(404, `Task ${id} not found.`);
  return t;
}

export function listTasks(
  filter: { projectId?: string; state?: string } = {},
): (Task & { project_name: string })[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.projectId) {
    where.push("t.project_id = ?");
    params.push(filter.projectId);
  }
  if (filter.state) {
    where.push("t.state = ?");
    params.push(filter.state);
  }
  return all(
    `select t.*, p.name as project_name from tasks t join projects p on p.id = t.project_id ${where.length ? "where " + where.join(" and ") : ""} order by t.created_at desc limit 300`,
    ...params,
  );
}

export function taskEvents(taskId: string): TaskEvent[] {
  return all<TaskEvent>("select * from task_events where task_id = ? order by id asc", taskId);
}

export function addEvent(
  taskId: string,
  kind: string,
  message: string,
  data?: unknown,
  from?: string | null,
  to?: string | null,
) {
  run(
    "insert into task_events (task_id, at, kind, from_state, to_state, message, data_json) values (?,?,?,?,?,?,?)",
    taskId,
    now(),
    kind,
    from ?? null,
    to ?? null,
    message,
    data === undefined ? null : JSON.stringify(data),
  );
}

export function transition(
  taskId: string,
  to: TaskState,
  message: string,
  patch: {
    blocked_reason?: string | null;
    error?: string | null;
    result_summary?: string | null;
  } = {},
) {
  const t = getTask(taskId);
  if (!canTransition(t.state, to))
    throw new ValaError(409, `Task cannot move from ${t.state} to ${to}.`);
  const terminal = TERMINAL.includes(to);
  run(
    `update tasks set state = ?, updated_at = ?, blocked_reason = ?, error = coalesce(?, error), result_summary = coalesce(?, result_summary),
       started_at = coalesce(started_at, case when ? = 'ANALYZING' then ? end),
       finished_at = case when ? then ? else finished_at end,
       lease_owner = case when ? then null else lease_owner end, lease_until = case when ? then null else lease_until end
     where id = ?`,
    to,
    now(),
    to === "BLOCKED" ? (patch.blocked_reason ?? message) : null,
    patch.error ?? null,
    patch.result_summary ?? null,
    to,
    now(),
    terminal ? 1 : 0,
    now(),
    terminal || to === "BLOCKED" ? 1 : 0,
    terminal || to === "BLOCKED" ? 1 : 0,
    taskId,
  );
  addEvent(taskId, "transition", message, undefined, t.state, to);
  touch(t.project_id);
}

export function createTask(
  projectId: string,
  input: { title: string; instruction: string },
  actor: Operator,
): Task {
  getProject(projectId);
  requireReadyWorkspace(projectId);
  const req = approvedRequirement(projectId);
  if (!req)
    throw new ValaError(
      409,
      "Approve the project's requirements first. Tasks are built against an approved contract.",
    );
  if (checksOf(req).length === 0)
    throw new ValaError(
      409,
      "The approved requirement has no acceptance checks, so no result could be verified.",
    );
  const title = input.title?.trim();
  const instruction = input.instruction?.trim();
  if (!title || !instruction) throw new ValaError(400, "Task title and instruction are required.");
  const id = newId("T", 8);
  run(
    "insert into tasks (id, project_id, requirement_id, title, instruction, state, max_fix_loops, created_by, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?)",
    id,
    projectId,
    req.id,
    title.slice(0, 200),
    instruction.slice(0, 8000),
    "PENDING",
    getSettings().max_fix_loops,
    actor.id,
    now(),
    now(),
  );
  addEvent(
    id,
    "created",
    `Task created against requirement v${req.version}.`,
    { requirementId: req.id },
    null,
    "PENDING",
  );
  audit(actor.id, "task.create", "task", id, { projectId, requirement: req.id });
  touch(projectId);
  return getTask(id);
}

export function requestCancel(taskId: string, actor: Operator): Task {
  const t = getTask(taskId);
  if (TERMINAL.includes(t.state)) throw new ValaError(409, `Task is already ${t.state}.`);
  if (t.state === "BLOCKED" || t.state === "PENDING") {
    transition(taskId, "CANCELLED", `Cancelled by ${actor.name}.`);
  } else {
    run("update tasks set cancel_requested = 1, updated_at = ? where id = ?", now(), taskId);
    addEvent(
      taskId,
      "cancel_requested",
      `Cancel requested by ${actor.name}; stopping at the running step.`,
    );
  }
  audit(actor.id, "task.cancel", "task", taskId);
  return getTask(taskId);
}

export function resumeTask(taskId: string, actor: Operator): Task {
  const t = getTask(taskId);
  if (t.state !== "BLOCKED") throw new ValaError(409, "Only a blocked task can be resumed.");
  transition(taskId, "PENDING", `Resumed by ${actor.name} after: ${t.blocked_reason ?? "block"}.`);
  audit(actor.id, "task.resume", "task", taskId);
  return getTask(taskId);
}

/** Runs one acceptance check in the workspace and records it as evidence. */
export async function runCheck(
  task: Task,
  ws: Workspace,
  check: AcceptanceCheck,
  producer: "agent" | "verifier",
  signal?: AbortSignal,
): Promise<Evidence> {
  const settings = getSettings();
  const tokens = parseCommand(check.command);
  const commit = headCommit(ws);
  const id = newId("EV", 10);
  const policy = sandboxPolicy();
  const common = {
    cwd: ws.path,
    timeoutMs: settings.command_timeout_s * 1000,
    maxOutputBytes: settings.max_output_kb * 1024,
    signal,
  };
  let sandbox = "none";
  let result: ExecResult;
  if (policy.mode === "docker") {
    const problem = dockerProblem(policy);
    if (problem) {
      sandbox = "refused";
      result = {
        exitCode: 126,
        timedOut: false,
        cancelled: false,
        durationMs: 0,
        truncated: false,
        output: `[vala-ai] Refused: checks must run in the sandbox (VALA_AI_SANDBOX=docker), and ${problem}\n`,
      };
    } else {
      sandbox = `docker ${policy.image}`;
      result = await runCommand(tokens, {
        ...common,
        sandbox: { policy, name: containerName(id) },
      });
    }
  } else {
    result = await runCommand(tokens, common);
  }
  const dir = resolve(paths.evidence(), task.project_id);
  mkdirSync(dir, { recursive: true });
  const header = `# ${check.label}\n$ ${tokens.join(" ")}\n# sandbox ${sandbox}\n# commit ${commit}\n# exit ${result.exitCode} timed_out=${result.timedOut} cancelled=${result.cancelled} duration_ms=${result.durationMs}${result.truncated ? " (output truncated to last bytes)" : ""}\n\n`;
  const content = header + result.output;
  const outputPath = resolve(dir, `${id}.log`);
  writeFileSync(outputPath, content, "utf8");
  const verdict: Evidence["verdict"] = result.cancelled
    ? "unknown"
    : result.exitCode === 0 && !result.timedOut
      ? "pass"
      : "fail";
  run(
    `insert into evidence (id, task_id, project_id, check_id, label, command, commit_sha, exit_code, timed_out, duration_ms, output_path, output_sha256, output_tail, producer, verdict, sandbox, created_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    task.id,
    task.project_id,
    check.id,
    check.label,
    check.command,
    commit,
    result.exitCode,
    result.timedOut ? 1 : 0,
    result.durationMs,
    outputPath,
    sha256(content),
    tail(result.output, 4000),
    producer,
    verdict,
    sandbox,
    now(),
  );
  addEvent(
    task.id,
    "check",
    `${producer === "verifier" ? "Verifier" : "Agent"} ran "${check.label}": ${verdict.toUpperCase()} (exit ${result.exitCode ?? "none"}${result.timedOut ? ", timed out" : ""}).`,
    { evidenceId: id, commit },
  );
  return one<Evidence>("select * from evidence where id = ?", id)!;
}

export function listEvidence(filter: { taskId?: string; projectId?: string } = {}): Evidence[] {
  if (filter.taskId)
    return all<Evidence>(
      "select * from evidence where task_id = ? order by created_at asc",
      filter.taskId,
    );
  if (filter.projectId)
    return all<Evidence>(
      "select * from evidence where project_id = ? order by created_at desc limit 500",
      filter.projectId,
    );
  return all<Evidence>("select * from evidence order by created_at desc limit 500");
}

export function getEvidence(id: string): Evidence {
  const e = one<Evidence>("select * from evidence where id = ?", id);
  if (!e) throw new ValaError(404, "Evidence not found.");
  return e;
}

/**
 * A task's verification status, derived only from verifier evidence at the
 * task's final commit: VERIFIED needs every acceptance check to have a passing
 * verifier run there; anything less is FAILED or UNKNOWN, never assumed.
 */
export function verificationOf(task: Task): {
  status: "VERIFIED" | "FAILED" | "UNKNOWN";
  commit: string | null;
  checks: { check: AcceptanceCheck; evidence: Evidence | null }[];
} {
  const req = getRequirement(task.requirement_id);
  const checks = checksOf(req);
  const verifierRuns = all<Evidence>(
    "select * from evidence where task_id = ? and producer = 'verifier' order by created_at desc",
    task.id,
  );
  const commit = verifierRuns[0]?.commit_sha ?? null;
  const rows = checks.map((check) => ({
    check,
    evidence:
      verifierRuns.find(
        (e) => e.check_id === check.id && e.commit_sha === commit && e.command === check.command,
      ) ?? null,
  }));
  if (!commit || rows.some((r) => !r.evidence || r.evidence.verdict === "unknown"))
    return { status: "UNKNOWN", commit, checks: rows };
  if (rows.some((r) => r.evidence!.verdict !== "pass"))
    return { status: "FAILED", commit, checks: rows };
  return { status: "VERIFIED", commit, checks: rows };
}
