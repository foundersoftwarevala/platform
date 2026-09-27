/**
 * The self-healing worker, as cron runs it.
 *
 * The platform already schedules work one way: a shell script in
 * /usr/local/bin invoked by the root crontab, nine of them. This follows that
 * rather than introducing a second mechanism, so there is one place to look
 * when something is running that should not be.
 *
 * It is a single bounded pass, not a daemon. Cron starts it, it works at most
 * a handful of incidents, and it exits. That matters more than it sounds: a
 * long-lived healing loop is a process that can wedge, leak, or keep acting
 * after somebody has decided it should stop, and the one thing this component
 * must never do is outlive the decision to switch it off.
 *
 *   node scripts/ops/self-healing-worker.mjs [--budget 5] [--dry-run]
 *
 * Exit codes: 0 worked or idled cleanly, 1 the pass itself failed. A refusal
 * from a guard is not a failure — it is the guard working, and it exits 0.
 */
import { readFileSync } from "node:fs";
import { hostname } from "node:os";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at < 0 || line.trim().startsWith("#")) continue;
    out[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const env = process.env.SUPABASE_URL ? process.env : readEnv(".env.ops");
const BASE = (env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!BASE) {
  console.error("SUPABASE_URL is needed");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const args = process.argv.slice(2);
const budgetAt = args.indexOf("--budget");
const BUDGET = budgetAt >= 0 ? Math.max(1, Math.min(25, Number(args[budgetAt + 1]) || 5)) : 5;
const DRY_RUN = args.includes("--dry-run");
const WORKER = `${hostname()}:${process.pid}`;

/**
 * Graceful shutdown.
 *
 * On SIGTERM the pass stops after the incident in hand rather than in the
 * middle of one. Abandoning a recovery halfway is worse than finishing it:
 * the lock ages out eventually, but the action may already have been taken
 * and never recorded, which is the one state the audit cannot reconstruct.
 */
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    console.log(`[self-healing] ${signal} received; finishing the current incident then stopping`);
  });
}

const get = async (path) => {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: H });
  return r.ok ? r.json() : null;
};
const patch = async (path, body) =>
  fetch(`${BASE}/rest/v1/${path}`, { method: "PATCH", headers: H, body: JSON.stringify(body) });
const post = async (table, body) =>
  fetch(`${BASE}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
const rpc = async (name, body) => {
  const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${(await r.text()).slice(0, 160)}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [data];
};

// ----------------------------------------------------------- the actions
//
// Only the ones that genuinely do something, each wired to the system that
// already owns that kind of repair. The rest stay unimplemented rather than
// pretending: an action that reports success without acting closes an
// incident while the fault remains, which is the worst outcome this engine
// can produce. The reasoning for each omission is recorded below, beside the
// map, so nobody has to guess whether it was decided or forgotten.

async function reduceConcurrency(incident) {
  if (incident.entity_type !== "ai_agents" || !incident.entity_id) {
    return { result: "INCONCLUSIVE", error: "this action applies to an agent; none is named" };
  }
  const agent = (await get(`ai_agents?select=id,max_concurrent&id=eq.${incident.entity_id}`))?.[0];
  if (!agent) return { result: "INCONCLUSIVE", error: "the agent no longer exists" };
  const current = Number(agent.max_concurrent ?? 1);
  if (current <= 1) {
    return { result: "INCONCLUSIVE", error: "the agent is already at the minimum of one" };
  }
  const reduced = Math.max(1, Math.floor(current / 2));
  await patch(`ai_agents?id=eq.${incident.entity_id}`, { max_concurrent: reduced });
  return {
    result: "SUCCEEDED",
    outcome: `concurrency reduced from ${current} to ${reduced}`,
    scopeRows: 1,
    scopeDescription: `ai_agents:${incident.entity_id}`,
    // What to put back if this turns out not to have helped. Without it, a
    // halved ceiling stays halved forever on the strength of a guess.
    reversible: true,
    previousState: { table: "ai_agents", id: incident.entity_id, max_concurrent: current },
  };
}

async function reassign(incident) {
  if (incident.entity_type !== "tm_tasks" || !incident.entity_id) {
    return { result: "INCONCLUSIVE", error: "this action applies to a task; none is named" };
  }
  const task = (await get(`tm_tasks?select=id,assigned_to&id=eq.${incident.entity_id}`))?.[0];
  if (!task) return { result: "INCONCLUSIVE", error: "the task no longer exists" };
  await patch(`tm_tasks?id=eq.${incident.entity_id}`, { assigned_to: null });
  return {
    result: "SUCCEEDED",
    outcome: "the task was released for reassignment",
    scopeRows: 1,
    scopeDescription: `tm_tasks:${incident.entity_id}`,
    reversible: true,
    previousState: { table: "tm_tasks", id: incident.entity_id, assigned_to: task.assigned_to },
  };
}

/**
 * backoff — wait longer before the next attempt, and say why.
 *
 * Deferring is not repairing, which is why its verification always says no.
 * But how long to defer is worth getting right: a dependency that is down
 * will not be up in thirty seconds, and a transient blip does not need five
 * minutes. So the delay follows the failure class and what has already been
 * tried, and is bounded at both ends by the policy's own recovery window
 * rather than by a number chosen here.
 *
 * It can never grow without limit: max_recovery_minutes is the ceiling, and
 * the attempt ceiling stops the incident long before the delay could matter.
 */
async function backoff(incident) {
  const budget = (
    await get(
      `founder_recovery_budgets?select=max_recovery_minutes,max_attempts&failure_class=eq.${incident.failure_class}`,
    )
  )?.[0];
  const windowSeconds = Math.max(60, Number(budget?.max_recovery_minutes ?? 30) * 60);
  const tried = Math.max(1, Number(incident.attempts ?? 1));

  // Doubling, but never past a fraction of the window the policy allows for
  // the whole recovery — otherwise a backoff could outlast the budget it is
  // supposed to be spending.
  const base = incident.failure_class === "DEPENDENCY" ? 120 : 30;
  const seconds = Math.min(Math.round(windowSeconds / 4), base * 2 ** (tried - 1));

  await patch(`founder_incidents?id=eq.${incident.id}`, {
    next_attempt_at: new Date(Date.now() + seconds * 1000).toISOString(),
  });
  return {
    result: "SUCCEEDED",
    outcome:
      `next attempt deferred by ${seconds}s after ${tried} attempt(s); ` +
      `a ${incident.failure_class} recovery may run for ${Math.round(windowSeconds / 60)} minute(s) in total`,
    scopeRows: 1,
    scopeDescription: `founder_incidents:${incident.id}`,
  };
}

/**
 * retry — re-run the operation that failed.
 *
 * The owner is the queue that holds it. i18n_translation_jobs is the one on
 * this box with a live consumer and its own attempt ceiling, and it is the
 * one place where a failure is genuinely orphaned: i18n_claim_translation_jobs
 * picks up 'queued' rows and reclaims expired leases by itself, but nothing
 * ever looks at a row left in 'failed'. So this requeues it and lets the
 * existing worker run it again. The queue's own ceiling still applies — a job
 * at max_attempts is left alone rather than retried forever.
 */
async function retry(incident) {
  if (incident.entity_type !== "i18n_translation_jobs" || !incident.entity_id) {
    return { result: "INCONCLUSIVE", error: "this action applies to a queued job; none is named" };
  }
  const job = (
    await get(
      `i18n_translation_jobs?select=id,status,attempts,max_attempts&id=eq.${incident.entity_id}`,
    )
  )?.[0];
  if (!job) return { result: "INCONCLUSIVE", error: "the job no longer exists" };
  if (job.status !== "failed") {
    return {
      result: "INCONCLUSIVE",
      error: `the job is '${job.status}', so nothing failed to retry`,
    };
  }
  if (Number(job.attempts) >= Number(job.max_attempts)) {
    return {
      result: "INCONCLUSIVE",
      error: `the queue's own ceiling is reached (${job.attempts} of ${job.max_attempts})`,
    };
  }
  await patch(`i18n_translation_jobs?id=eq.${incident.entity_id}`, {
    status: "queued",
    locked_by: null,
    locked_at: null,
    run_after: new Date().toISOString(),
    last_error: null,
  });
  return {
    result: "SUCCEEDED",
    outcome: `requeued for the existing worker after attempt ${job.attempts} of ${job.max_attempts}`,
    scopeRows: 1,
    scopeDescription: `i18n_translation_jobs:${incident.entity_id}`,
  };
}

/**
 * resume — continue an interrupted workflow from where it stopped.
 *
 * AYRA is the workflow engine that owns ordered, multi-step work. A step left
 * RUNNING by a worker that died, or BLOCKED by a condition that has cleared,
 * returns to PLANNED so the orchestrator dispatches it again. Position and
 * evidence are preserved, so the order carries on from its valid state rather
 * than starting over — and the capability guard on the table independently
 * refuses to arm a step whose capability is not connected.
 */
async function resume(incident) {
  if (incident.entity_type !== "ayra_order_steps" || !incident.entity_id) {
    return {
      result: "INCONCLUSIVE",
      error: "this action applies to a workflow step; none is named",
    };
  }
  const step = (
    await get(
      `ayra_order_steps?select=id,order_id,position,state,capability&id=eq.${incident.entity_id}`,
    )
  )?.[0];
  if (!step) return { result: "INCONCLUSIVE", error: "the step no longer exists" };
  if (!["RUNNING", "BLOCKED"].includes(step.state)) {
    return {
      result: "INCONCLUSIVE",
      error: `the step is '${step.state}', which is not an interrupted state`,
    };
  }

  // Resuming means continuing, so everything before it must already be done.
  const earlier =
    (await get(
      `ayra_order_steps?select=position,state&order_id=eq.${step.order_id}` +
        `&position=lt.${step.position}&state=not.in.(DONE,VERIFIED,SKIPPED)`,
    )) ?? [];
  if (earlier.length > 0) {
    return {
      result: "INCONCLUSIVE",
      error: `${earlier.length} earlier step(s) are unfinished, so this is not the resume point`,
    };
  }

  const response = await patch(`ayra_order_steps?id=eq.${incident.entity_id}`, {
    state: "PLANNED",
    agent_run_id: null,
    blocked_reason: null,
    error: null,
  });
  if (!response.ok) {
    return {
      result: "FAILED",
      error: `the workflow guard refused it: ${(await response.text()).slice(0, 200)}`,
    };
  }
  return {
    result: "SUCCEEDED",
    outcome: `step ${step.position} re-armed from ${step.state}; earlier steps left intact`,
    scopeRows: 1,
    scopeDescription: `ayra_order_steps:${incident.entity_id}`,
    reversible: true,
    previousState: { table: "ayra_order_steps", id: incident.entity_id, state: step.state },
  };
}

/**
 * Putting back what a recovery changed.
 *
 * Only reached when a reversible action succeeded and its verification then
 * said no. The action did something; it did not help; leaving it in place
 * means the engine has quietly changed production on a failed hypothesis.
 *
 * The reversal is recorded as its own attempt pointing at the one it undoes,
 * never as an edit of it — the attempt log refuses edits, and that is the
 * point: both the change and its reversal stay readable.
 */
async function rollback(previousState) {
  if (!previousState?.table || !previousState?.id) {
    return { ok: false, detail: "nothing was captured to roll back to" };
  }
  const { table, id, ...fields } = previousState;
  if (Object.keys(fields).length === 0) {
    return { ok: false, detail: "the captured state named no columns" };
  }
  const response = await patch(`${table}?id=eq.${id}`, fields);
  if (!response.ok) {
    return {
      ok: false,
      detail: `the restore was refused: ${(await response.text()).slice(0, 160)}`,
    };
  }
  // Read it back rather than trusting the write.
  const columns = Object.keys(fields).join(",");
  const now = (await get(`${table}?select=${columns}&id=eq.${id}`))?.[0];
  const restored =
    now && Object.entries(fields).every(([k, v]) => String(now[k] ?? "") === String(v ?? ""));
  return {
    ok: restored,
    detail: restored
      ? `${table}:${id} put back to ${JSON.stringify(fields)}`
      : `the restore did not read back as expected: ${JSON.stringify(now)}`,
  };
}

// reroute, rebalance and fallback_route are deliberately absent.
//
// Not because they are hard, but because each already has an owner that does
// the same thing, and a second implementation would either duplicate it or
// fight it:
//
//   reroute        i18n_claim_translation_jobs already returns a job whose
//                  lease expired to the pool, and the AI router already walks
//                  its ordered route list when one fails. There is no third
//                  worker pool with an eligible alternate to move work to.
//   rebalance      there is no workload to redistribute: tm_members is empty,
//                  so tm_assignment_candidates returns nobody, and
//                  ai_agent_runs holds no runs. The only real queue of
//                  assignable work is leads, and moving a customer between
//                  agents is a business decision, not a low-risk repair.
//   fallback_route the route table's fallback is exercised per request by
//                  AI API Manager's router, which owns provider access.
//                  Demoting a route is a provider decision, and confirming
//                  "the fallback answers and passes the same validation"
//                  means paying for a live call.
//
// Leaving them out is not a gap being hidden: the engine's own path for an
// incident with no implemented action opens the circuit and says so, which is
// the honest outcome. An action that reported success without acting would
// close an incident while the fault remained.

const IMPLEMENTED = {
  reduce_concurrency: reduceConcurrency,
  reassign,
  backoff,
  retry,
  resume,
};

// ------------------------------------------------------ the verifications
//
// Separate from the action, and deliberately able to say no.

async function verifyAction(action, incident) {
  if (action === "reduce_concurrency" && incident.entity_id) {
    const agent = (await get(`ai_agents?select=max_concurrent&id=eq.${incident.entity_id}`))?.[0];
    if (!agent) return { verified: false, detail: "the agent could not be read back" };
    const open =
      (await get(
        `ai_agent_runs?select=id&agent_id=eq.${incident.entity_id}&state=in.(RUNNING,WAITING)&limit=100`,
      )) ?? [];
    const within = open.length <= Number(agent.max_concurrent ?? 1);
    return {
      verified: within,
      detail: `${open.length} run(s) in flight against a ceiling of ${agent.max_concurrent}`,
    };
  }

  if (action === "reassign" && incident.entity_id) {
    const task = (await get(`tm_tasks?select=assigned_to&id=eq.${incident.entity_id}`))?.[0];
    if (!task) return { verified: false, detail: "the task could not be read back" };
    return {
      verified: task.assigned_to === null,
      detail: task.assigned_to === null ? "the task is unassigned" : "the task still has an owner",
    };
  }

  // Requeuing is not recovery. What proves a retry worked is the existing
  // worker picking the job up and finishing it, so this waits for that rather
  // than reporting success on the strength of having asked.
  if (action === "retry" && incident.entity_id) {
    // How long to wait is the policy's decision, not a number picked here:
    // each failure class already declares the longest an attempt may take.
    // It is capped so a slow check cannot eat the whole cron slot, and the
    // first real run proved why this matters — a 45s guess gave up 40s before
    // the queue finished, and reported an honest but useless "not yet".
    const policy = (
      await get(
        `founder_recovery_policies?select=attempt_timeout_seconds&failure_class=eq.${incident.failure_class}`,
      )
    )?.[0];
    const window = Math.min(150, Math.max(30, Number(policy?.attempt_timeout_seconds ?? 120)));
    const deadline = Date.now() + window * 1000;
    let last = null;
    while (Date.now() < deadline && !stopping) {
      const job = (
        await get(
          `i18n_translation_jobs?select=status,attempts,locked_by&id=eq.${incident.entity_id}`,
        )
      )?.[0];
      if (!job) return { verified: false, detail: "the job could not be read back" };
      last = job;
      if (job.status === "done") {
        return {
          verified: true,
          detail: `the worker re-ran it and it completed after ${job.attempts} attempt(s)`,
        };
      }
      if (job.status === "failed") {
        return {
          verified: false,
          detail: `it was re-run and failed again after ${job.attempts} attempt(s)`,
        };
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    return {
      verified: false,
      detail:
        `still '${last?.status ?? "unknown"}' after ${window}s; requeued but not yet recovered, ` +
        `so the incident stays open rather than being called healed`,
    };
  }

  if (action === "resume" && incident.entity_id) {
    const step = (
      await get(`ayra_order_steps?select=order_id,position,state&id=eq.${incident.entity_id}`)
    )?.[0];
    if (!step) return { verified: false, detail: "the step could not be read back" };
    if (step.state !== "PLANNED") {
      return { verified: false, detail: `the step is '${step.state}', not re-armed` };
    }
    // Resumed, not restarted: the work already finished must still be finished.
    const earlier =
      (await get(
        `ayra_order_steps?select=position&order_id=eq.${step.order_id}` +
          `&position=lt.${step.position}&state=not.in.(DONE,VERIFIED,SKIPPED)`,
      )) ?? [];
    return {
      verified: earlier.length === 0,
      detail:
        earlier.length === 0
          ? `step ${step.position} is runnable again and every earlier step is still complete`
          : `${earlier.length} earlier step(s) were undone, so this restarted rather than resumed`,
    };
  }

  if (action === "backoff") {
    // Deferring is not repairing. Saying so here is what stops a backoff
    // resolving an incident that is still broken.
    return {
      verified: false,
      detail: "backoff defers the next attempt; it does not establish that the fault is gone",
    };
  }

  return { verified: false, detail: `no verification is implemented for ${action}` };
}

// ------------------------------------------------------------- one pass

let claimed = 0;
let resolved = 0;
let refused = 0;
const lines = [];

for (let i = 0; i < BUDGET && !stopping; i += 1) {
  let claim;
  try {
    claim = (
      await rpc("founder_incident_claim", { p_worker: WORKER, p_lock_timeout_seconds: 300 })
    )[0];
  } catch (error) {
    console.error(`[self-healing] claim failed: ${error.message}`);
    process.exit(1);
  }

  // Nothing to do, or the engine is switched off — the claim returns nothing
  // in both cases, which is why a disabled engine simply idles.
  if (!claim?.incident_id) break;
  claimed += 1;

  const incident = (await get(`founder_incidents?select=*&id=eq.${claim.incident_id}`))?.[0];
  if (!incident) continue;

  const prior =
    (await get(`founder_recovery_attempts?select=action&incident_id=eq.${claim.incident_id}`)) ??
    [];
  const tried = prior.map((a) => a.action);
  const attemptNumber = prior.length + 1;

  // Only actions this class permits, and only ones that genuinely act.
  // Which of the permitted actions to reach for first.
  //
  // The policy's order is the default and the floor: nothing outside
  // allowed_actions is ever considered, and an action is never skipped for
  // being unproven. What changes the order is evidence — an action of this
  // class that has actually verified before is tried ahead of one that never
  // has. That is the only sense in which this engine learns, and it is
  // counted from the attempt log rather than remembered separately, so it
  // cannot drift away from what really happened.
  const permitted = (claim.allowed_actions ?? []).filter(
    (a) => !tried.includes(a) && IMPLEMENTED[a],
  );
  const history =
    (await get(
      `founder_recovery_strategy_performance?select=strategy,verified,verified_rate,proven` +
        `&failure_class=eq.${claim.failure_class}`,
    )) ?? [];
  const provenScore = (action) => {
    const row = history.find((h) => h.strategy === action);
    return row?.proven ? Number(row.verified ?? 0) : -1;
  };
  const ordered = [...permitted].sort((a, b) => {
    const byProof = provenScore(b) - provenScore(a);
    if (byProof !== 0) return byProof;
    // Same evidence, so fall back to the order the policy wrote them in.
    return (claim.allowed_actions ?? []).indexOf(a) - (claim.allowed_actions ?? []).indexOf(b);
  });
  const candidate = ordered[0];
  const chosenBecause =
    provenScore(candidate) > 0
      ? `${claim.failure_class} policy permits ${candidate}, and ${provenScore(candidate)} recovery/recoveries of this class have verified with it; ${tried.length} earlier action(s) did not resolve it`
      : `${claim.failure_class} policy permits ${candidate}; no recovery of this class has verified with it yet; ${tried.length} earlier action(s) did not resolve it`;

  if (!candidate) {
    await patch(`founder_incidents?id=eq.${claim.incident_id}`, {
      state: "RETRY_PENDING",
      circuit_open: true,
      circuit_reason: "no permitted action with a working implementation remains for this incident",
      locked_by: null,
      locked_at: null,
    });
    lines.push(`  ${incident.title}: no implemented action remains; circuit opened`);
    refused += 1;
    continue;
  }

  if (DRY_RUN) {
    await patch(`founder_incidents?id=eq.${claim.incident_id}`, {
      state: "RETRY_PENDING",
      locked_by: null,
      locked_at: null,
    });
    lines.push(`  ${incident.title}: would attempt ${candidate} (dry run)`);
    continue;
  }

  const performed = await IMPLEMENTED[candidate](incident).catch((error) => ({
    result: "FAILED",
    error: String(error?.message ?? error).slice(0, 300),
  }));

  const checked =
    performed.result === "SUCCEEDED"
      ? await verifyAction(candidate, incident).catch(() => ({
          verified: false,
          detail: "the verification check itself failed",
        }))
      : { verified: false, detail: "the action did not succeed, so nothing was verified" };

  const attemptResponse = await post("founder_recovery_attempts", {
    incident_id: claim.incident_id,
    attempt_number: attemptNumber,
    action: candidate,
    chosen_because: chosenBecause,
    result: performed.result,
    outcome: performed.outcome ?? null,
    error: performed.error ?? null,
    idempotency_key: `${claim.incident_id}:${candidate}:${attemptNumber}`,
    executed_by: WORKER,
    scope_rows: performed.scopeRows ?? 1,
    scope_description: performed.scopeDescription ?? null,
    reversible: performed.reversible === true,
    previous_state: performed.previousState ?? null,
    verified: checked.verified,
    verification_method: checked.verified ? claim.verification_method : null,
    verification_detail: checked.verified ? checked.detail : null,
    verified_at: checked.verified ? new Date().toISOString() : null,
    finished_at: new Date().toISOString(),
  });

  if (!attemptResponse.ok) {
    // A guard refused it — a budget, a duplicate, a limit. That is the system
    // working, so the incident is released rather than escalated.
    const why = (await attemptResponse.text()).slice(0, 180);
    await patch(`founder_incidents?id=eq.${claim.incident_id}`, {
      state: "RETRY_PENDING",
      locked_by: null,
      locked_at: null,
    });
    lines.push(`  ${incident.title}: refused by a guard — ${why}`);
    refused += 1;
    continue;
  }

  const attempt = (await attemptResponse.json())[0];

  if (checked.verified) {
    await patch(`founder_incidents?id=eq.${claim.incident_id}`, { state: "VERIFYING" });
    await patch(`founder_incidents?id=eq.${claim.incident_id}`, {
      state: "RESOLVED",
      resolved_by_attempt: attempt.id,
      resolved_at: new Date().toISOString(),
      attempts: attemptNumber,
      locked_by: null,
      locked_at: null,
    });
    resolved += 1;

    // What was learned, written where the platform already keeps what it
    // knows rather than in a store of this engine's own. founder_memory
    // handles the parts that are easy to get wrong: it refuses to overwrite
    // an existing memory about the same subject without a reason, keeps the
    // one it replaced, and carries the confidence and the evidence with the
    // statement. Only a verified recovery is written, so nothing here can
    // recommend a strategy that has never been seen to work.
    const subject = `recovery:${claim.failure_class}:${incident.entity_type ?? "unscoped"}`;
    await rpc("founder_memory_record", {
      p_scope: "OPERATIONAL",
      p_subject: subject,
      p_statement:
        `A ${claim.failure_class} failure on ${incident.entity_type ?? "an unnamed entity"} ` +
        `was recovered by ${candidate}, confirmed by: ${checked.detail}`,
      p_source_system: "self-healing",
      p_detail:
        `Incident: ${incident.title}\nWhat was done: ${performed.outcome}\n` +
        `How it was checked: ${claim.verification_method}\nAttempt ${attemptNumber} of ${claim.max_attempts}.`,
      p_source_ref: attempt.id,
      p_actor_kind: "SYSTEM",
      // MEASURED, because it is a recorded outcome that was checked against
      // the thing itself — not an estimate and not a model's opinion.
      p_confidence: "MEASURED",
      p_verified_at: new Date().toISOString(),
      p_supersede_reason: `a later ${candidate} recovery of this class verified on ${new Date().toISOString().slice(0, 10)}`,
    }).catch((error) => {
      // A memory that cannot be written must never undo a recovery that
      // worked. It is reported and the incident stays resolved.
      lines.push(
        `  ${incident.title}: recovery stands, but the memory was not written — ${error.message}`,
      );
    });

    lines.push(`  ${incident.title}: ${candidate} verified — ${checked.detail}`);
    continue;
  }

  // The action ran, changed something, and the change did not help. Leaving
  // it there would mean production quietly carries the cost of a failed
  // hypothesis, so anything reversible goes back.
  let undone = "";
  if (performed.result === "SUCCEEDED" && performed.reversible === true) {
    const put = await rollback(performed.previousState).catch((error) => ({
      ok: false,
      detail: `the rollback itself failed: ${String(error?.message ?? error).slice(0, 160)}`,
    }));
    const record = await post("founder_recovery_attempts", {
      incident_id: claim.incident_id,
      // Its own number, because (incident_id, attempt_number) is unique and
      // reusing the original's collides. The guards exempt a row carrying
      // rollback_of from the attempt ceiling, so numbering it next cannot
      // push the audit past a limit and lose it.
      attempt_number: attemptNumber + 1,
      action: candidate,
      chosen_because: `${candidate} was not verified, and it was reversible, so what it changed was put back`,
      result: put.ok ? "SUCCEEDED" : "FAILED",
      outcome: put.ok ? put.detail : null,
      error: put.ok ? null : put.detail,
      idempotency_key: `${claim.incident_id}:${candidate}:${attemptNumber}:rollback`,
      executed_by: WORKER,
      scope_rows: performed.scopeRows ?? 1,
      scope_description: performed.scopeDescription ?? null,
      rollback_of: attempt.id,
      // A rollback is itself not reversible: undoing an undo is just the
      // original action, and the engine should choose that deliberately.
      reversible: false,
      // Rolling back is restoring a known state, not repairing the fault, so
      // it is never verified — for the same reason backoff never is.
      verified: false,
      finished_at: new Date().toISOString(),
    });
    undone = put.ok ? `; rolled back — ${put.detail}` : `; ROLLBACK FAILED — ${put.detail}`;
    if (!record.ok) {
      undone += ` (and the rollback could not be recorded: ${(await record.text()).slice(0, 120)})`;
    }
  }

  const exhausted = attemptNumber >= Number(claim.max_attempts ?? 1);
  await patch(`founder_incidents?id=eq.${claim.incident_id}`, {
    state: "RETRY_PENDING",
    attempts: attemptNumber,
    circuit_open: exhausted,
    circuit_reason: exhausted
      ? `${attemptNumber} attempt(s) made without a verified recovery`
      : null,
    locked_by: null,
    locked_at: null,
  });
  lines.push(
    `  ${incident.title}: ${candidate} ${performed.result.toLowerCase()}, unverified — ${checked.detail}${undone}`,
  );
}

const health = (await get("founder_healing_self_check?select=*&limit=1"))?.[0] ?? {};

console.log(
  `[self-healing] ${claimed} claimed, ${resolved} resolved, ${refused} refused` +
    (stopping ? " (stopped early on signal)" : ""),
);
for (const line of lines) console.log(line);
if (health.enabled === false)
  console.log(`[self-healing] engine is switched off: ${health.disabled_reason}`);
if (health.degraded) console.log(`[self-healing] DEGRADED — ${health.stale_locks} stale lock(s)`);

process.exit(0);
