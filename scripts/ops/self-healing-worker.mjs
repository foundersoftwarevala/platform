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
// Only the three that genuinely do something. The other five stay
// unimplemented rather than pretending: an action that reports success
// without acting closes an incident while the fault remains, which is the
// worst outcome this engine can produce.

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
  };
}

async function backoff(incident) {
  const seconds = Math.min(300, 30 * Math.max(1, Number(incident.attempts ?? 1)));
  await patch(`founder_incidents?id=eq.${incident.id}`, {
    next_attempt_at: new Date(Date.now() + seconds * 1000).toISOString(),
  });
  return {
    result: "SUCCEEDED",
    outcome: `next attempt deferred by ${seconds}s`,
    scopeRows: 1,
    scopeDescription: `founder_incidents:${incident.id}`,
  };
}

const IMPLEMENTED = {
  reduce_concurrency: reduceConcurrency,
  reassign,
  backoff,
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
  const candidate = (claim.allowed_actions ?? []).find((a) => !tried.includes(a) && IMPLEMENTED[a]);

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
    chosen_because: `${claim.failure_class} policy permits ${candidate}; ${tried.length} earlier action(s) did not resolve it`,
    result: performed.result,
    outcome: performed.outcome ?? null,
    error: performed.error ?? null,
    idempotency_key: `${claim.incident_id}:${candidate}:${attemptNumber}`,
    executed_by: WORKER,
    scope_rows: performed.scopeRows ?? 1,
    scope_description: performed.scopeDescription ?? null,
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
    lines.push(`  ${incident.title}: ${candidate} verified — ${checked.detail}`);
    continue;
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
    `  ${incident.title}: ${candidate} ${performed.result.toLowerCase()}, unverified — ${checked.detail}`,
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
