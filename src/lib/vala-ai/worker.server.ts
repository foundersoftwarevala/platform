import { randomBytes } from "node:crypto";
import { analyze, build, complete, fix, test } from "./agent.server.ts";
import { all, one, run } from "./db.server.ts";
import { ModelOfflineError, modelStatus } from "./model.server.ts";
import { sandboxPolicy, sweepStaleContainers } from "./sandbox.server.ts";
import { getSettings, resources } from "./settings.server.ts";
import { ACTIVE, addEvent, getTask, transition, type Task } from "./tasks.server.ts";
import { now, ValaError } from "./util.server.ts";

/**
 * The background runner. One task step at a time (this host's CPU is the
 * limit), claimed through a lease in the database so a crashed or restarted
 * server picks the task up again from the state it was in. Before each step
 * it checks the resource floors and the local model; either missing turns the
 * task BLOCKED with the reason instead of failing it.
 */

type WorkerState = {
  owner: string;
  timer: ReturnType<typeof setTimeout> | null;
  busy: string | null;
  controllers: Map<string, AbortController>;
  startedAt: string;
  lastTick: string | null;
  lastError: string | null;
  stopped: boolean;
  lastSweep?: number;
};

const G = globalThis as typeof globalThis & { __valaWorker?: WorkerState };

function state(): WorkerState {
  if (!G.__valaWorker) {
    G.__valaWorker = {
      owner: `${process.pid}-${randomBytes(4).toString("hex")}`,
      timer: null,
      busy: null,
      controllers: new Map(),
      startedAt: now(),
      lastTick: null,
      lastError: null,
      stopped: true,
    };
  }
  return G.__valaWorker;
}

export function workerStatus() {
  const s = state();
  return {
    running: !s.stopped,
    owner: s.owner,
    busyTask: s.busy,
    startedAt: s.startedAt,
    lastTick: s.lastTick,
    lastError: s.lastError,
  };
}

export function ensureWorker() {
  if (process.env.VALA_AI_WORKER === "off") return;
  const s = state();
  if (!s.stopped) return;
  s.stopped = false;
  schedule(500);
}

export function stopWorker() {
  const s = state();
  s.stopped = true;
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
}

/** Aborts a running step in this process, if any. */
export function abortRunning(taskId: string) {
  state().controllers.get(taskId)?.abort();
}

function schedule(ms: number) {
  const s = state();
  if (s.stopped) return;
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    void tick();
  }, ms);
}

/**
 * A claimed task holds a short lease that the running step keeps renewing.
 * If the server dies mid-step the renewals stop, and another runner (or this
 * one after a restart) takes the task over within LEASE_SECONDS.
 */
export const LEASE_SECONDS = 90;
const HEARTBEAT_MS = 30_000;

function leaseUntil() {
  return new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
}

/** Claims the oldest runnable task. Atomic: the UPDATE only succeeds while the lease is free. */
export function claimNext(owner: string): Task | null {
  const placeholders = ACTIVE.map(() => "?").join(",");
  const candidates = all<Task>(
    `select * from tasks where state in (${placeholders}) and (lease_until is null or lease_until < ?) order by created_at asc limit 5`,
    ...ACTIVE,
    now(),
  );
  for (const t of candidates) {
    const until = leaseUntil();
    const res = run(
      "update tasks set lease_owner = ?, lease_until = ? where id = ? and (lease_until is null or lease_until < ?)",
      owner,
      until,
      t.id,
      now(),
    );
    if (Number(res.changes) === 1) {
      if (t.lease_owner && t.lease_owner !== owner)
        addEvent(
          t.id,
          "recovered",
          `Resumed in state ${t.state} after the previous runner (${t.lease_owner}) stopped.`,
        );
      return getTask(t.id);
    }
  }
  return null;
}

export async function runStep(task: Task, owner: string, signal: AbortSignal): Promise<void> {
  if (task.cancel_requested) {
    transition(task.id, "CANCELLED", "Cancelled at operator request.");
    return;
  }
  const res = resources();
  if (!res.ok) {
    transition(task.id, "BLOCKED", `Resource limits: ${res.problems.join(" ")}`);
    return;
  }
  if (["PENDING", "ANALYZING", "BUILDING", "FIXING"].includes(task.state)) {
    const model = await modelStatus();
    if (!model.online) {
      transition(
        task.id,
        "BLOCKED",
        `Local model offline at ${model.url} (${model.error}). Start it, then resume the task.`,
      );
      return;
    }
  }
  switch (task.state) {
    case "PENDING":
      transition(task.id, "ANALYZING", "Picked up by the runner.");
      break;
    case "ANALYZING":
      await analyze(task, signal);
      break;
    case "BUILDING":
      await build(task, signal);
      break;
    case "TESTING":
    case "RETESTING":
      await test(task, signal);
      break;
    case "FIXING":
      await fix(task, signal);
      break;
    case "VERIFIED":
      complete(task);
      break;
    default:
      break;
  }
  // Release the lease between steps so a cancel or another runner can act.
  run(
    "update tasks set lease_owner = null, lease_until = null where id = ? and lease_owner = ?",
    task.id,
    owner,
  );
}

/**
 * One step with the runner's failure handling: a step that throws leaves the
 * task CANCELLED (if a cancel was asked for), BLOCKED (model offline or slow)
 * or FAILED with the reason — never stuck in an active state. Returns the
 * error message, if any.
 */
export async function runStepSafely(
  task: Task,
  owner: string,
  signal: AbortSignal,
): Promise<string | null> {
  const heartbeat = setInterval(() => {
    run(
      "update tasks set lease_until = ? where id = ? and lease_owner = ?",
      leaseUntil(),
      task.id,
      owner,
    );
  }, HEARTBEAT_MS);
  try {
    await runStep(task, owner, signal);
    return null;
  } catch (e) {
    const err = e as ValaError;
    try {
      const fresh = one<Task>("select * from tasks where id = ?", task.id);
      if (fresh && ACTIVE.includes(fresh.state)) {
        if ((fresh.cancel_requested || err.status === 499) && fresh.state !== "VERIFIED")
          transition(task.id, "CANCELLED", "Cancelled while running.");
        else if (
          (e instanceof ModelOfflineError || err.status === 504) &&
          fresh.state !== "VERIFIED"
        )
          transition(task.id, "BLOCKED", err.message);
        else
          transition(task.id, "FAILED", `Step ${fresh.state} failed: ${err.message}`, {
            error: err.message,
          });
      }
      return err.message;
    } catch (inner) {
      run("update tasks set lease_owner = null, lease_until = null where id = ?", task.id);
      return `${err.message}; then ${(inner as Error).message}`;
    }
  } finally {
    clearInterval(heartbeat);
  }
}

async function tick() {
  const s = state();
  s.lastTick = now();
  // Containers left behind by a crashed server are removed every ten minutes.
  try {
    const policy = sandboxPolicy();
    if (policy.mode === "docker" && Date.now() - (s.lastSweep ?? 0) > 600_000) {
      s.lastSweep = Date.now();
      sweepStaleContainers(policy, getSettings().command_timeout_s * 1000 + 60_000);
    }
  } catch {
    /* a misconfigured sandbox is reported where checks run and in /status */
  }
  if (s.busy) return schedule(1000);
  let task: Task | null = null;
  try {
    task = claimNext(s.owner);
  } catch (e) {
    s.lastError = (e as Error).message;
    return schedule(5000);
  }
  if (!task) return schedule(3000);

  s.busy = task.id;
  const controller = new AbortController();
  s.controllers.set(task.id, controller);
  try {
    s.lastError = await runStepSafely(task, s.owner, controller.signal);
  } finally {
    s.controllers.delete(task.id);
    s.busy = null;
    schedule(200);
  }
}
