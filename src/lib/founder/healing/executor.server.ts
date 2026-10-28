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
type ActionReceipt = {
  result: ExecutionOutcome["result"];
  outcome?: string;
  error?: string;
  scopeRows?: number;
  scopeDescription?: string;
  previousState?: Row;
  reversible?: boolean;
  verificationRef?: string;
};

async function performAction(
  action: string,
  incident: Row,
  attemptNumber: number,
): Promise<ActionReceipt> {
  const entityType = incident.entity_type ? String(incident.entity_type) : null;
  const entityId = incident.entity_id ? String(incident.entity_id) : null;

  switch (action) {
    case "backoff": {
      const delaySeconds = Math.min(300, 30 * Math.max(1, Number(incident.attempts ?? 1)));
      await patch("founder_incidents", `id=eq.${String(incident.id)}`, {
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      });
      return {
        result: "SUCCEEDED",
        outcome: `next attempt deferred by ${delaySeconds}s`,
        scopeRows: 1,
        scopeDescription: "one self-healing incident retry schedule",
        previousState: { next_attempt_at: incident.next_attempt_at ?? null },
        reversible: true,
      };
    }

    case "reassign": {
      if (entityType !== "tm_tasks" || !entityId) {
        return {
          result: "INCONCLUSIVE",
          error: "reassignment requires an incident linked to a task",
        };
      }
      const [task] = await rows(`tm_tasks?select=id,status,assigned_to&id=eq.${entityId}&limit=1`);
      if (!task)
        return {
          result: "INCONCLUSIVE",
          error: "the task named by this incident no longer exists",
        };
      if (task.assigned_to === null)
        return { result: "INCONCLUSIVE", error: "the task is already unassigned" };
      await patch("tm_tasks", `id=eq.${entityId}`, { assigned_to: null });
      return {
        result: "SUCCEEDED",
        outcome: "the task was released for reassignment",
        scopeRows: 1,
        scopeDescription: "one task assignment",
        previousState: { status: task.status, assigned_to: task.assigned_to },
        reversible: true,
      };
    }

    case "reduce_concurrency": {
      if (entityType !== "ai_agents" || !entityId) {
        return {
          result: "INCONCLUSIVE",
          error: "reducing concurrency requires an incident linked to an agent",
        };
      }
      const [agent] = await rows(`ai_agents?select=id,max_concurrent&id=eq.${entityId}&limit=1`);
      if (!agent)
        return {
          result: "INCONCLUSIVE",
          error: "the agent named by this incident no longer exists",
        };
      const current = Number(agent.max_concurrent ?? 1);
      if (current <= 1)
        return { result: "INCONCLUSIVE", error: "the agent is already at the minimum of one" };
      const reduced = Math.max(1, Math.floor(current / 2));
      await patch("ai_agents", `id=eq.${entityId}`, { max_concurrent: reduced });
      return {
        result: "SUCCEEDED",
        outcome: `concurrency reduced from ${current} to ${reduced}`,
        scopeRows: 1,
        scopeDescription: "one agent concurrency limit",
        previousState: { max_concurrent: current },
        reversible: true,
      };
    }

    case "retry": {
      if (entityType !== "fa_jobs" || !entityId) {
        return {
          result: "INCONCLUSIVE",
          error: "retry requires an incident linked to a failed Founder AI job",
        };
      }
      const [job] = await rows(
        `fa_jobs?select=id,job_type,payload,reference,priority,max_attempts,status,last_error_class,idempotency_key,correlation_id&id=eq.${entityId}&limit=1`,
      );
      if (!job)
        return { result: "INCONCLUSIVE", error: "the job named by this incident no longer exists" };
      const retryable = ["transient", "rate_limit", "timeout"].includes(
        String(job.last_error_class ?? ""),
      );
      if (job.status !== "dead_letter" || !retryable) {
        return {
          result: "INCONCLUSIVE",
          error:
            "only dead-letter jobs with transient, rate-limit, or timeout errors may be retried",
        };
      }
      if (typeof job.idempotency_key !== "string" || !job.idempotency_key) {
        return { result: "INCONCLUSIVE", error: "the failed job has no idempotency key" };
      }
      const retried = await rpc("fa_enqueue", {
        p_job_type: String(job.job_type),
        p_payload: job.payload ?? {},
        p_reference: job.reference ?? String(job.id),
        p_priority: Number(job.priority ?? 100),
        p_max_attempts: Number(job.max_attempts ?? 5),
        p_run_after: new Date().toISOString(),
        p_idempotency_key: `${job.idempotency_key}:healing:${incident.id}:${attemptNumber}`,
        p_correlation_id: job.correlation_id ?? null,
      });
      const accepted = retried[0];
      if (accepted?.ok !== true || !accepted.job_id) {
        return {
          result: "FAILED",
          error: `the Founder AI queue rejected the retry: ${String(accepted?.reason ?? "unknown reason")}`,
        };
      }
      return {
        result: "SUCCEEDED",
        outcome:
          accepted.duplicate === true
            ? "an equivalent retry was already queued"
            : "a retry job was queued",
        scopeRows: 1,
        scopeDescription: "one retry job for a dead-lettered Founder AI task",
        previousState: {
          job_id: job.id,
          status: job.status,
          last_error_class: job.last_error_class,
        },
        reversible: false,
        verificationRef: String(accepted.job_id),
      };
    }

    case "resume": {
      if (entityType !== "tm_tasks" || !entityId) {
        return { result: "INCONCLUSIVE", error: "resume requires an incident linked to a task" };
      }
      const [task] = await rows(`tm_tasks?select=id,status&id=eq.${entityId}&limit=1`);
      if (!task)
        return {
          result: "INCONCLUSIVE",
          error: "the task named by this incident no longer exists",
        };
      if (task.status !== "on_hold" && task.status !== "blocked") {
        return {
          result: "INCONCLUSIVE",
          error: `task status ${String(task.status)} is not resumable`,
        };
      }
      await patch("tm_tasks", `id=eq.${entityId}`, { status: "in_progress" });
      return {
        result: "SUCCEEDED",
        outcome: `task resumed from ${String(task.status)}`,
        scopeRows: 1,
        scopeDescription: "one paused task status",
        previousState: { status: task.status },
        reversible: false,
      };
    }

    case "rebalance": {
      if (entityType !== "tm_tasks" || !entityId) {
        return { result: "INCONCLUSIVE", error: "rebalance requires an incident linked to a task" };
      }
      const [task] = await rows(
        `tm_tasks?select=id,status,assigned_role&id=eq.${entityId}&limit=1`,
      );
      if (!task)
        return {
          result: "INCONCLUSIVE",
          error: "the task named by this incident no longer exists",
        };
      const routed = await rpc("founder_healing_rebalance_task", { p_task_id: entityId });
      const result = routed[0];
      if (result?.ok !== true || typeof result.role !== "string") {
        return {
          result: "INCONCLUSIVE",
          error: `task rebalance was not performed: ${String(result?.reason ?? "unknown reason")}`,
        };
      }
      return {
        result: "SUCCEEDED",
        outcome: `task routed to ${result.role} (${String(result.load_percent)}% load)`,
        scopeRows: 1,
        scopeDescription: "one eligible task role assignment",
        previousState: { status: task.status, assigned_role: task.assigned_role ?? null },
        reversible: true,
        verificationRef: result.role,
      };
    }

    case "reroute":
    case "fallback_route":
      return {
        result: "INCONCLUSIVE",
        error: `${action} remains disabled because no approved traffic or provider target mapping exists`,
      };

    default:
      return { result: "INCONCLUSIVE", error: `no implementation exists for ${action}` };
  }
}

async function verify(
  action: string,
  incident: Row,
  receipt: ActionReceipt,
): Promise<{ verified: boolean; detail: string }> {
  const entityType = incident.entity_type ? String(incident.entity_type) : null;
  const entityId = incident.entity_id ? String(incident.entity_id) : null;

  if (action === "reduce_concurrency" && entityType === "ai_agents" && entityId) {
    const [agent] = await rows(`ai_agents?select=max_concurrent&id=eq.${entityId}&limit=1`);
    if (!agent) return { verified: false, detail: "the agent could not be read back" };
    const open = await rows(
      `ai_agent_runs?select=id&agent_id=eq.${entityId}&state=in.(RUNNING,WAITING)&limit=50`,
    );
    const within = open.length <= Number(agent.max_concurrent ?? 1);
    return {
      verified: within,
      detail: within
        ? `${open.length} run(s) in flight against a ceiling of ${agent.max_concurrent}`
        : `${open.length} run(s) still exceed the reduced ceiling of ${agent.max_concurrent}`,
    };
  }

  if (action === "reassign" && entityType === "tm_tasks" && entityId) {
    const [task] = await rows(`tm_tasks?select=assigned_to&id=eq.${entityId}&limit=1`);
    if (!task) return { verified: false, detail: "the task could not be read back" };
    const released = task.assigned_to === null;
    return {
      verified: released,
      detail: released
        ? "the task is unassigned and available to be claimed"
        : "the task still has an owner",
    };
  }

  if (action === "retry" && receipt.verificationRef) {
    const [job] = await rows(`fa_jobs?select=id,status&id=eq.${receipt.verificationRef}&limit=1`);
    const queued =
      job && ["queued", "running", "retrying", "completed"].includes(String(job.status));
    return {
      verified: Boolean(queued),
      detail: queued
        ? `retry job is ${String(job.status)}`
        : "the retry job is not present in the queue",
    };
  }

  if (action === "resume" && entityType === "tm_tasks" && entityId) {
    const [task] = await rows(`tm_tasks?select=status&id=eq.${entityId}&limit=1`);
    const resumed = task?.status === "in_progress";
    return {
      verified: Boolean(resumed),
      detail: resumed
        ? "the task is in progress"
        : `the task is ${String(task?.status ?? "unavailable")}`,
    };
  }

  if (action === "rebalance" && entityType === "tm_tasks" && entityId && receipt.verificationRef) {
    const [task] = await rows(`tm_tasks?select=assigned_role&id=eq.${entityId}&limit=1`);
    const routed = task?.assigned_role === receipt.verificationRef;
    return {
      verified: Boolean(routed),
      detail: routed
        ? `the task is routed to ${receipt.verificationRef}`
        : "the new task route was not retained",
    };
  }

  if (action === "backoff") {
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
  );
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

  const decisionSourceKey = `self_healing:${claim.incidentId}:${action}:${attemptNumber}`;
  const existingDecision = await rows(
    `ai_decision_logs?select=id&source_key=eq.${encodeURIComponent(decisionSourceKey)}&limit=1`,
  );
  if (existingDecision[0]) {
    await patch("founder_incidents", `id=eq.${claim.incidentId}`, {
      state: "RETRY_PENDING",
      locked_by: null,
      locked_at: null,
    });
    return {
      acted: false,
      action,
      result: "ABANDONED",
      verified: false,
      incidentState: "RETRY_PENDING",
      reason:
        "a matching decision record exists without a recorded recovery attempt; manual review is required",
    };
  }

  await insert("ai_decision_logs", {
    decision: `Self-healing ${action}: ${String(incident.title ?? claim.incidentId)}`,
    confidence: 0,
    input_summary: `incident=${claim.incidentId}; failure_class=${claim.failureClass}; attempt=${attemptNumber}`,
    output_summary: `Policy-authorized ${action} action is being evaluated; confidence is not model-generated.`,
    outcome: "deferred",
    decision_type: `self_healing.${action}`,
    status: "deferred",
    source_key: decisionSourceKey,
  });

  const performed: ActionReceipt = await performAction(action, incident, attemptNumber).catch(
    (error): ActionReceipt => ({
      result: "FAILED",
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    }),
  );

  const checked =
    performed.result === "SUCCEEDED"
      ? await verify(action, incident, performed).catch((error) => ({
          verified: false,
          detail: `verification failed: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`,
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
      verification_method: performed.result === "SUCCEEDED" ? claim.verificationMethod : null,
      verification_detail: checked.detail,
      verified_at: checked.verified ? new Date().toISOString() : null,
      finished_at: new Date().toISOString(),
      scope_rows: performed.scopeRows ?? 0,
      scope_description: performed.scopeDescription ?? null,
      previous_state: performed.previousState ?? null,
      reversible: performed.reversible ?? null,
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

  const decisionStatus =
    performed.result === "FAILED" ? "escalated" : checked.verified ? "accepted" : "deferred";
  const decisionSummary = [
    `Action result: ${performed.result}.`,
    performed.outcome ?? performed.error ?? "No outcome detail was returned.",
    checked.detail,
  ]
    .join(" ")
    .slice(0, 2000);
  await patch("ai_decision_logs", `source_key=eq.${encodeURIComponent(decisionSourceKey)}`, {
    status: decisionStatus,
    outcome: decisionStatus,
    output_summary: decisionSummary,
  });

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
