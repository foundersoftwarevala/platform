/**
 * The recovery executor.
 *
 * This is the part that actually does something, and it is deliberately the
 * smallest, dullest component in the self-healing engine. Everything
 * interesting — what may be attempted, how often, what counts as verified —
 * already lives in the policies and the database guards. The executor's job
 * is to pick one incident, take one permitted action, write down honestly
 * what happened, and check it.
 *
 * Three rules it does not get to bend, because the database enforces them:
 *
 *   It cannot take an action the policy does not allow for that class.
 *   It cannot exceed the attempt limit, or act on an open circuit.
 *   It cannot resolve an incident without a verified attempt.
 *
 * That matters because this is the component most likely to have a bug. A
 * worker that loops, crashes mid-action and retries, or misreads a result is
 * ordinary; a worker that can talk its way past the limits is not, and the
 * design assumes the first while preventing the second.
 *
 * Every action here is a real operation against something that already
 * exists. There is no action that pretends: where an action cannot be carried
 * out on this platform, the attempt is recorded as INCONCLUSIVE with the
 * reason, which keeps the incident open rather than closing it on a fiction.
 */

export type RecoveryAction =
  | "retry"
  | "backoff"
  | "reroute"
  | "fallback_route"
  | "reduce_concurrency"
  | "rebalance"
  | "resume"
  | "reassign";

export interface ClaimedIncident {
  incidentId: string;
  failureClass: string;
  attempts: number;
  allowedActions: string[];
  maxAttempts: number;
  verificationMethod: string | null;
}

export interface ExecutionOutcome {
  acted: boolean;
  action?: string;
  result: "SUCCEEDED" | "FAILED" | "INCONCLUSIVE" | "ABANDONED";
  outcome?: string;
  error?: string;
  verified: boolean;
  verificationDetail?: string;
  /** What the incident became. */
  incidentState: string;
  reason: string;
}

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rows(path: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${path}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${path.split("?")[0]}: ${response.status}`);
  return (await response.json()) as Row[];
}

async function insert(table: string, body: unknown): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table}: ${response.status} ${text.slice(0, 200)}`);
  }
  return (await response.json()) as Row[];
}

async function patch(table: string, filter: string, body: unknown): Promise<void> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: restHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
}

async function rpc(name: string, body: unknown): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: restHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${name}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const data = (await response.json()) as Row[] | Row;
  return Array.isArray(data) ? data : [data];
}

/**
 * Claim one incident to work on.
 *
 * The claim is a database function using SKIP LOCKED, so two workers never
 * take the same row and a crashed worker's lock ages out rather than holding
 * an incident forever.
 */
export async function claimIncident(worker: string): Promise<ClaimedIncident | null> {
  const data = await rpc("founder_incident_claim", {
    p_worker: worker,
    p_lock_timeout_seconds: 300,
  });
  const row = data[0];
  if (!row?.incident_id) return null;
  return {
    incidentId: String(row.incident_id),
    failureClass: String(row.failure_class),
    attempts: Number(row.attempts ?? 0),
    allowedActions: Array.isArray(row.allowed_actions) ? row.allowed_actions.map(String) : [],
    maxAttempts: Number(row.max_attempts ?? 1),
    verificationMethod: row.verification_method ? String(row.verification_method) : null,
  };
}

/**
 * Which action to take next, given what has already been tried.
 *
 * Deliberately ordered rather than clever: the cheapest and least disruptive
 * action first, escalating only because the previous one did not work. The
 * list comes from the policy, so this can never propose an action for the
 * wrong class.
 */
export function chooseAction(claim: ClaimedIncident, alreadyTried: string[]): string | null {
  const untried = claim.allowedActions.filter((a) => !alreadyTried.includes(a));
  return untried[0] ?? null;
}

/**
 * Carry out one action.
 *
 * Each branch does something real to something that exists. Where an action
 * has no implementation on this platform, it returns INCONCLUSIVE naming the
 * gap rather than reporting a success nobody performed — an unimplemented
 * recovery that claims to have worked is the worst possible outcome here,
 * because it closes the incident and the fault stays.
 */
async function performAction(
  action: string,
  incident: Row,
): Promise<{ result: ExecutionOutcome["result"]; outcome?: string; error?: string }> {
  const entityType = incident.entity_type ? String(incident.entity_type) : null;
  const entityId = incident.entity_id ? String(incident.entity_id) : null;

  switch (action) {
    case "backoff": {
      // A real action with a real effect: the incident is not retried until
      // the delay has passed, which is what backoff means here.
      const delaySeconds = Math.min(300, 30 * Math.max(1, Number(incident.attempts ?? 1)));
      await patch("founder_incidents", `id=eq.${String(incident.id)}`, {
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      });
      return { result: "SUCCEEDED", outcome: `next attempt deferred by ${delaySeconds}s` };
    }

    case "reassign": {
      // Reassignment is only meaningful for work that has an owner. It goes
      // through the ordinary task path, so the task engine's own transition
      // guard and audit apply.
      if (entityType !== "tm_tasks" || !entityId) {
        return {
          result: "INCONCLUSIVE",
          error: "reassignment applies to a task, and this incident names none",
        };
      }
      const task = await rows(`tm_tasks?select=id,status,assigned_to&id=eq.${entityId}&limit=1`);
      if (!task[0]) {
        return {
          result: "INCONCLUSIVE",
          error: "the task named by this incident no longer exists",
        };
      }
      await patch("tm_tasks", `id=eq.${entityId}`, { assigned_to: null });
      return { result: "SUCCEEDED", outcome: "the task was released for reassignment" };
    }

    case "reduce_concurrency": {
      // Real and reversible: the agent that is struggling takes less at once.
      if (entityType !== "ai_agents" || !entityId) {
        return {
          result: "INCONCLUSIVE",
          error: "reducing concurrency applies to an agent, and this incident names none",
        };
      }
      const agent = await rows(`ai_agents?select=id,max_concurrent&id=eq.${entityId}&limit=1`);
      const current = Number(agent[0]?.max_concurrent ?? 1);
      if (current <= 1) {
        return { result: "INCONCLUSIVE", error: "the agent is already at the minimum of one" };
      }
      const reduced = Math.max(1, Math.floor(current / 2));
      await patch("ai_agents", `id=eq.${entityId}`, { max_concurrent: reduced });
      return { result: "SUCCEEDED", outcome: `concurrency reduced from ${current} to ${reduced}` };
    }

    case "retry":
    case "reroute":
    case "fallback_route":
    case "rebalance":
    case "resume":
      // These need the system that owns the failing operation to re-run it.
      // Nothing here can do that on its own, and saying so leaves the
      // incident open, which is the honest outcome.
      return {
        result: "INCONCLUSIVE",
        error: `${action} requires the owning system to re-run the operation; no such caller is wired yet`,
      };

    default:
      return { result: "INCONCLUSIVE", error: `no implementation exists for ${action}` };
  }
}

/**
 * Check whether the action actually fixed anything.
 *
 * This is separate from whether the action succeeded, and that separation is
 * the entire point of the engine. Where the platform cannot check, this
 * returns unverified with the reason — which keeps the incident open.
 */
async function verify(
  action: string,
  incident: Row,
): Promise<{ verified: boolean; detail: string }> {
  const entityType = incident.entity_type ? String(incident.entity_type) : null;
  const entityId = incident.entity_id ? String(incident.entity_id) : null;

  if (action === "reduce_concurrency" && entityType === "ai_agents" && entityId) {
    const agent = await rows(
      `ai_agents?select=max_concurrent,blocked_reason&id=eq.${entityId}&limit=1`,
    );
    const row = agent[0];
    if (!row) return { verified: false, detail: "the agent could not be read back" };
    const open = await rows(
      `ai_agent_runs?select=id&agent_id=eq.${entityId}&state=in.(RUNNING,WAITING)&limit=50`,
    ).catch(() => [] as Row[]);
    const within = open.length <= Number(row.max_concurrent ?? 1);
    return {
      verified: within,
      detail: within
        ? `${open.length} run(s) in flight against a ceiling of ${row.max_concurrent}`
        : `${open.length} run(s) still exceed the reduced ceiling of ${row.max_concurrent}`,
    };
  }

  if (action === "reassign" && entityType === "tm_tasks" && entityId) {
    const task = await rows(`tm_tasks?select=assigned_to,status&id=eq.${entityId}&limit=1`);
    const row = task[0];
    if (!row) return { verified: false, detail: "the task could not be read back" };
    const released = row.assigned_to === null;
    return {
      verified: released,
      detail: released
        ? "the task is unassigned and available to be claimed"
        : "the task still has an owner",
    };
  }

  if (action === "backoff") {
    // Deferring a retry is not a repair. It buys time, and calling it a
    // verified recovery would resolve an incident that is still broken.
    return {
      verified: false,
      detail: "backoff defers the next attempt; it does not establish that the fault is gone",
    };
  }

  return {
    verified: false,
    detail: `no verification method is implemented for ${action} on this platform`,
  };
}

/**
 * Work one incident: act once, record it, check it, and move the state.
 *
 * Returns what happened rather than throwing, because a worker that dies on
 * one incident stops healing everything else.
 */
export async function executeOne(worker: string): Promise<ExecutionOutcome | null> {
  let claim: ClaimedIncident | null;
  try {
    claim = await claimIncident(worker);
  } catch (error) {
    console.error("[founder/healing] could not claim an incident:", error);
    return null;
  }
  if (!claim) return null;

  const incidentRows = await rows(`founder_incidents?select=*&id=eq.${claim.incidentId}&limit=1`);
  const incident = incidentRows[0];
  if (!incident) return null;

  const priorAttempts = await rows(
    `founder_recovery_attempts?select=action,attempt_number&incident_id=eq.${claim.incidentId}`,
  ).catch(() => [] as Row[]);
  const tried = priorAttempts.map((a) => String(a.action));
  const attemptNumber = priorAttempts.length + 1;

  // The limit is enforced by the database too; checking here means the
  // circuit opens deliberately rather than by insert failure.
  if (attemptNumber > claim.maxAttempts) {
    await patch("founder_incidents", `id=eq.${claim.incidentId}`, {
      state: "RETRY_PENDING",
      circuit_open: true,
      circuit_reason: `${claim.maxAttempts} attempt(s) allowed for a ${claim.failureClass} failure, all used`,
      locked_by: null,
      locked_at: null,
    });
    return {
      acted: false,
      result: "ABANDONED",
      verified: false,
      incidentState: "RETRY_PENDING",
      reason: "the attempt limit was reached; the circuit is open",
    };
  }

  const action = chooseAction(claim, tried);
  if (!action) {
    await patch("founder_incidents", `id=eq.${claim.incidentId}`, {
      state: "RETRY_PENDING",
      circuit_open: true,
      circuit_reason: "every action this policy allows has already been tried",
      locked_by: null,
      locked_at: null,
    });
    return {
      acted: false,
      result: "ABANDONED",
      verified: false,
      incidentState: "RETRY_PENDING",
      reason: "every permitted action has been tried",
    };
  }

  // The idempotency key is what stops a worker that crashed after acting from
  // acting again when it restarts: the insert is refused rather than repeated.
  const idempotencyKey = `${claim.incidentId}:${action}:${attemptNumber}`;

  // Typed explicitly so the catch branch has the same shape as the success
  // one; otherwise the union loses `outcome` and the failure path silently
  // becomes the only thing the compiler knows about.
  type ActionResult = {
    result: ExecutionOutcome["result"];
    outcome?: string;
    error?: string;
  };

  const performed: ActionResult = await performAction(action, incident).catch(
    (error): ActionResult => ({
      result: "FAILED",
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    }),
  );

  const checked =
    performed.result === "SUCCEEDED"
      ? await verify(action, incident).catch(() => ({
          verified: false,
          detail: "the verification check itself failed",
        }))
      : { verified: false, detail: "the action did not succeed, so nothing was verified" };

  try {
    await insert("founder_recovery_attempts", {
      incident_id: claim.incidentId,
      attempt_number: attemptNumber,
      action,
      chosen_because: `${claim.failureClass} policy permits ${action}; ${tried.length} earlier action(s) did not resolve it`,
      result: performed.result,
      outcome: performed.outcome ?? null,
      error: performed.error ?? null,
      idempotency_key: idempotencyKey,
      executed_by: worker,
      verified: checked.verified,
      verification_method: checked.verified ? claim.verificationMethod : null,
      verification_detail: checked.verified ? checked.detail : null,
      verified_at: checked.verified ? new Date().toISOString() : null,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    // A refused insert is the guard doing its job — a duplicate, a forbidden
    // action, or a limit reached. The incident is released, not resolved.
    await patch("founder_incidents", `id=eq.${claim.incidentId}`, {
      state: "RETRY_PENDING",
      locked_by: null,
      locked_at: null,
    }).catch(() => undefined);
    return {
      acted: false,
      action,
      result: "ABANDONED",
      verified: false,
      incidentState: "RETRY_PENDING",
      reason: error instanceof Error ? error.message.slice(0, 200) : String(error),
    };
  }

  const attemptRows = await rows(
    `founder_recovery_attempts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
  ).catch(() => [] as Row[]);
  const attemptId = attemptRows[0] ? String(attemptRows[0].id) : null;

  // Verified: through VERIFYING to RESOLVED, which is the only path there.
  if (checked.verified && attemptId) {
    await patch("founder_incidents", `id=eq.${claim.incidentId}`, { state: "VERIFYING" });
    await patch("founder_incidents", `id=eq.${claim.incidentId}`, {
      state: "RESOLVED",
      resolved_by_attempt: attemptId,
      resolved_at: new Date().toISOString(),
      attempts: attemptNumber,
      locked_by: null,
      locked_at: null,
    });
    return {
      acted: true,
      action,
      result: performed.result,
      outcome: performed.outcome,
      verified: true,
      verificationDetail: checked.detail,
      incidentState: "RESOLVED",
      reason: "the action was carried out and the check confirmed it",
    };
  }

  // Not verified. The incident stays open, and the circuit opens once the
  // policy's attempts are spent.
  const exhausted = attemptNumber >= claim.maxAttempts;
  await patch("founder_incidents", `id=eq.${claim.incidentId}`, {
    state: "RETRY_PENDING",
    attempts: attemptNumber,
    circuit_open: exhausted,
    circuit_reason: exhausted
      ? `${attemptNumber} attempt(s) made without a verified recovery`
      : null,
    locked_by: null,
    locked_at: null,
  });

  return {
    acted: true,
    action,
    result: performed.result,
    outcome: performed.outcome,
    error: performed.error,
    verified: false,
    verificationDetail: checked.detail,
    incidentState: "RETRY_PENDING",
    reason: exhausted
      ? "no verified recovery after the permitted attempts; the circuit is open"
      : "the attempt did not verify; the incident stays open",
  };
}

/**
 * Work up to `budget` incidents.
 *
 * Bounded on purpose. An unbounded loop over a queue that is filling faster
 * than it drains is how a recovery worker becomes the incident.
 */
export async function runRecoveryPass(
  worker: string,
  budget = 5,
): Promise<{ worked: number; resolved: number; outcomes: ExecutionOutcome[] }> {
  const outcomes: ExecutionOutcome[] = [];
  for (let i = 0; i < Math.max(1, Math.min(budget, 25)); i += 1) {
    const outcome = await executeOne(worker);
    if (!outcome) break;
    outcomes.push(outcome);
  }
  return {
    worked: outcomes.length,
    resolved: outcomes.filter((o) => o.incidentState === "RESOLVED").length,
    outcomes,
  };
}
