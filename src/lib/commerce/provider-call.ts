import { log } from "@/lib/commerce/observability";

/**
 * Every call this platform makes out to a payment provider goes through here.
 *
 * Before this existed, each adapter called `fetch` directly with no deadline at
 * all. That is the failure that takes a server down without anything appearing
 * to be broken: a provider stops answering but keeps the socket open, the
 * request never resolves, and the Node process accumulates handles until it can
 * no longer serve the checkout page either. Nothing logs an error, because
 * nothing has errored yet — it is simply still waiting.
 *
 * Three things are added, and only these three. No provider behaviour changes,
 * no adapter is rewritten, and every existing return shape is preserved.
 *
 *   1. A bounded deadline on every call, chosen per operation rather than one
 *      universal number. Opening a hosted checkout and issuing a refund are not
 *      the same kind of call and do not deserve the same patience.
 *   2. A circuit breaker per provider, so a provider that is genuinely down
 *      stops being called at all until it recovers. The point is not to be
 *      clever; it is that hammering a dead provider turns a provider outage
 *      into our outage, and that a customer is better told "try another method"
 *      in a second than made to wait fifteen for the same refusal.
 *   3. Retries, but only for operations where a retry cannot cost money.
 *
 * The third one is the rule worth stating plainly, because getting it wrong is
 * how a customer is charged twice: **a call that can move money is never
 * retried here**. Opening a checkout and issuing a refund are attempted exactly
 * once. Asking a provider what already happened is a question, not an
 * instruction, so that one may be asked again. Recovery for a mutation that
 * failed uncertainly is not a retry — it is the consistency sweep asking the
 * provider what became of the reference, which is a read.
 */

/* -------------------------------------------------------------------------- */
/* Operations                                                                  */
/* -------------------------------------------------------------------------- */

export type ProviderOperation =
  /** Open a hosted checkout session. Creates provider-side state. Never retried. */
  | "checkout_create"
  /** Ask what happened to a reference. Read-only, so safe to ask again. */
  | "verify"
  /** Send money back. The most consequential call here. Never retried. */
  | "refund"
  /** A published exchange rate. Read-only and not on the money path. */
  | "rate_lookup";

type Policy = {
  /** Deadline for one attempt, in milliseconds. */
  timeoutMs: number;
  /** Total attempts including the first. One means never retried. */
  attempts: number;
  /** Whether this call may move money, which forbids automatic retry. */
  mutating: boolean;
};

/**
 * The deadlines, per operation.
 *
 * They are set from what these calls actually do rather than from a round
 * number. A hosted checkout is a redirect the customer is waiting on, so it is
 * given long enough for a provider having a slow minute but not long enough to
 * hold a browser hostage. Verification runs in the background and on the
 * customer's return, and is retried, so each attempt can be tighter. A refund
 * is a single irreversible instruction, taken by providers who sometimes take
 * their time over it, and is never retried — so it is given the most room, and
 * a timeout on it means "unknown", never "failed".
 */
const POLICY: Record<ProviderOperation, Policy> = {
  checkout_create: { timeoutMs: 15_000, attempts: 1, mutating: true },
  verify: { timeoutMs: 12_000, attempts: 3, mutating: false },
  refund: { timeoutMs: 30_000, attempts: 1, mutating: true },
  rate_lookup: { timeoutMs: 8_000, attempts: 2, mutating: false },
};

/* -------------------------------------------------------------------------- */
/* The circuit breaker                                                         */
/* -------------------------------------------------------------------------- */

export type CircuitState = "closed" | "open" | "half_open";

type Outcome = { at: number; ok: boolean };

type Breaker = {
  state: CircuitState;
  /** Recent outcomes, trimmed to the window below. */
  history: Outcome[];
  /** When the breaker may next be probed, while open. */
  openedUntil: number;
  /** How many times in a row it has opened, which lengthens the cooldown. */
  consecutiveOpens: number;
  /** True while a half-open probe is in flight, so only one is let through. */
  probing: boolean;
  lastTransition: number;
  lastReason: string;
};

/** How far back outcomes count towards the decision to open. */
const WINDOW_MS = 60_000;
/** Below this many recent outcomes, one bad call is not evidence of an outage. */
const MIN_SAMPLES = 5;
/** Failure share, within the window, that counts as the provider being down. */
const FAILURE_RATIO = 0.5;
/** First cooldown. It doubles on each consecutive open, up to the cap. */
const BASE_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 10 * 60_000;

/**
 * Breaker state lives in this process.
 *
 * That is the honest scope of it, and it is the right scope here: the platform
 * runs one Node process under PM2 in fork mode, so "this process" and "the
 * server" are the same thing. A restart clears the breakers, which is correct
 * behaviour anyway — a freshly started process should find out for itself
 * whether a provider is answering rather than inherit a stale opinion.
 *
 * Every transition is logged and surfaced through payment health, so an open
 * circuit is visible to an operator rather than being a private fact.
 */
const BREAKERS = new Map<string, Breaker>();

function breakerFor(provider: string): Breaker {
  const key = provider.toLowerCase();
  let breaker = BREAKERS.get(key);
  if (!breaker) {
    breaker = {
      state: "closed",
      history: [],
      openedUntil: 0,
      consecutiveOpens: 0,
      probing: false,
      lastTransition: Date.now(),
      lastReason: "never tripped",
    };
    BREAKERS.set(key, breaker);
  }
  return breaker;
}

function transition(
  provider: string,
  breaker: Breaker,
  next: CircuitState,
  reason: string,
  correlation: string,
): void {
  if (breaker.state === next) return;
  const previous = breaker.state;
  breaker.state = next;
  breaker.lastTransition = Date.now();
  breaker.lastReason = reason;
  log({
    correlationId: correlation,
    component: "provider-call",
    action: "circuit_transition",
    // An opening circuit is an incident; closing again is good news.
    status: next === "open" ? "error" : "ok",
    errorCode: next === "open" ? "provider_circuit_open" : undefined,
    provider,
    from: previous,
    to: next,
    reason,
  });
}

/** How long the breaker stays shut after opening for the nth time running. */
function cooldownFor(consecutiveOpens: number): number {
  const exponent = Math.max(0, consecutiveOpens - 1);
  return Math.min(BASE_COOLDOWN_MS * 2 ** exponent, MAX_COOLDOWN_MS);
}

/**
 * Whether a call may go out right now.
 *
 * A half-open circuit lets exactly one call through. If a hundred requests
 * arrive the moment the cooldown expires, ninety-nine are still refused — which
 * is the entire point, since letting all of them through is how a provider that
 * is coming back up gets knocked over again.
 */
function admit(
  provider: string,
  breaker: Breaker,
  correlation: string,
): { allowed: boolean; probe: boolean } {
  if (breaker.state === "closed") return { allowed: true, probe: false };

  if (breaker.state === "open") {
    if (Date.now() < breaker.openedUntil) return { allowed: false, probe: false };
    transition(provider, breaker, "half_open", "cooldown elapsed, probing", correlation);
  }

  // half_open: one probe at a time.
  if (breaker.probing) return { allowed: false, probe: false };
  breaker.probing = true;
  return { allowed: true, probe: true };
}

function trim(breaker: Breaker): void {
  const cutoff = Date.now() - WINDOW_MS;
  breaker.history = breaker.history.filter((outcome) => outcome.at >= cutoff).slice(-40);
}

/**
 * Record how a call went, and open or close the circuit if that changed things.
 *
 * What counts as a failure is narrow on purpose: a timeout, a refused
 * connection, a 5xx, or a 429. A provider declining a card is a 4xx and a
 * perfectly healthy answer to a question — counting it here would trip the
 * circuit on a run of genuinely declined cards and stop everybody paying.
 */
function record(
  provider: string,
  breaker: Breaker,
  ok: boolean,
  reason: string,
  probe: boolean,
  correlation: string,
): void {
  if (probe) {
    breaker.probing = false;
    if (ok) {
      breaker.consecutiveOpens = 0;
      breaker.history = [];
      transition(provider, breaker, "closed", "probe succeeded", correlation);
    } else {
      breaker.consecutiveOpens += 1;
      breaker.openedUntil = Date.now() + cooldownFor(breaker.consecutiveOpens);
      transition(provider, breaker, "open", `probe failed: ${reason}`, correlation);
    }
    return;
  }

  breaker.history.push({ at: Date.now(), ok });
  trim(breaker);

  // Only a closed circuit can trip. An open one is waiting out its cooldown and
  // a half-open one is decided by its probe, above.
  if (breaker.state !== "closed" || ok) return;

  const samples = breaker.history.length;
  if (samples < MIN_SAMPLES) return;
  const failures = breaker.history.filter((outcome) => !outcome.ok).length;
  if (failures / samples < FAILURE_RATIO) return;

  breaker.consecutiveOpens += 1;
  breaker.openedUntil = Date.now() + cooldownFor(breaker.consecutiveOpens);
  transition(
    provider,
    breaker,
    "open",
    `${failures} of the last ${samples} calls failed (${reason})`,
    correlation,
  );
}

/** What the breakers currently say, for the health report and the routing check. */
export function circuitSnapshot(): {
  provider: string;
  state: CircuitState;
  /** Seconds until the next probe is allowed, while open. */
  openFor: number;
  reason: string;
}[] {
  const now = Date.now();
  return [...BREAKERS.entries()].map(([provider, breaker]) => ({
    provider,
    state: breaker.state,
    openFor:
      breaker.state === "open" ? Math.max(0, Math.round((breaker.openedUntil - now) / 1000)) : 0,
    reason: breaker.lastReason,
  }));
}

/**
 * Whether this provider is currently being skipped.
 *
 * Checkout uses this to leave an unreachable rail out of the methods it offers,
 * which is the same eligibility question it already asks about credentials and
 * currency — not a blind failover. No money moves on the strength of this
 * answer; it only decides which working provider a customer is sent to.
 */
export function circuitIsOpen(provider: string): boolean {
  const breaker = BREAKERS.get(provider.toLowerCase());
  if (!breaker) return false;
  return breaker.state === "open" && Date.now() < breaker.openedUntil;
}

/** Only for tests, which need breakers no earlier case has tripped. */
export function resetCircuits(): void {
  BREAKERS.clear();
}

/* -------------------------------------------------------------------------- */
/* The call                                                                    */
/* -------------------------------------------------------------------------- */

export type ProviderCallResult =
  | { ok: true; response: Response; attempts: number; durationMs: number }
  | {
      ok: false;
      /**
       * `circuit_open` and `timeout` both mean *unknown*, never *failed*. A
       * caller must not conclude from either that a payment did not happen.
       */
      kind: "circuit_open" | "timeout" | "network" | "upstream";
      status: number | null;
      error: string;
      attempts: number;
      durationMs: number;
    };

/** A 5xx or a 429 is the provider struggling; a 4xx is the provider answering. */
function isProviderFault(status: number): boolean {
  return status >= 500 || status === 429;
}

function backoffMs(attempt: number): number {
  // Exponential, with jitter, so a batch of retries does not arrive in step.
  const base = 250 * 2 ** (attempt - 1);
  return Math.round(base / 2 + Math.random() * base);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call a provider with a deadline, a circuit breaker and a safe retry policy.
 *
 * On success the caller gets the `Response` untouched and reads it exactly as
 * it did before. On failure it gets a reason it can act on, and the body of the
 * discarded attempt has already been drained so the socket is not left open.
 */
export async function providerFetch(input: {
  provider: string;
  operation: ProviderOperation;
  url: string;
  init?: RequestInit;
  correlationId?: string;
}): Promise<ProviderCallResult> {
  const { provider, operation, url } = input;
  const correlation = input.correlationId ?? `provider:${provider}:${operation}`;
  const policy = POLICY[operation];
  const breaker = breakerFor(provider);
  const started = Date.now();

  const gate = admit(provider, breaker, correlation);
  if (!gate.allowed) {
    log({
      correlationId: correlation,
      component: "provider-call",
      action: "short_circuited",
      status: "refused",
      errorCode: "provider_circuit_open",
      provider,
      operation,
    });
    return {
      ok: false,
      kind: "circuit_open",
      status: null,
      error: `${provider} is not responding at the moment.`,
      attempts: 0,
      durationMs: Date.now() - started,
    };
  }

  // A mutating call is attempted once whatever the policy table says. Belt and
  // braces: this is the invariant that stops a double charge, so it does not
  // depend on the table above still being right after a later edit.
  const maxAttempts = policy.mutating ? 1 : Math.max(1, policy.attempts);

  let attempt = 0;
  let lastKind: "timeout" | "network" | "upstream" = "network";
  let lastStatus: number | null = null;
  let lastError = `${provider} could not be reached.`;

  while (attempt < maxAttempts) {
    attempt += 1;
    const attemptStarted = Date.now();

    try {
      const response = await fetch(url, {
        ...input.init,
        signal: AbortSignal.timeout(policy.timeoutMs),
      });

      if (!isProviderFault(response.status)) {
        // Includes 4xx: the provider answered, and the answer is the adapter's
        // business to interpret. The circuit stays closed.
        record(provider, breaker, true, `http ${response.status}`, gate.probe, correlation);
        log({
          correlationId: correlation,
          component: "provider-call",
          action: "call",
          status: "ok",
          provider,
          operation,
          httpStatus: response.status,
          attempt,
          durationMs: Date.now() - attemptStarted,
        });
        return { ok: true, response, attempts: attempt, durationMs: Date.now() - started };
      }

      // A provider fault. Drain the body so the connection is not left hanging,
      // then decide whether this one may be tried again.
      lastKind = "upstream";
      lastStatus = response.status;
      lastError = `${provider} returned ${response.status}.`;
      try {
        await response.text();
      } catch {
        /* nothing left to drain */
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const timedOut = name === "TimeoutError" || name === "AbortError";
      lastKind = timedOut ? "timeout" : "network";
      lastStatus = null;
      lastError = timedOut
        ? `${provider} did not answer within ${policy.timeoutMs / 1000}s.`
        : `${provider} could not be reached.`;
    }

    log({
      correlationId: correlation,
      component: "provider-call",
      action: "call",
      status: "error",
      errorCode: lastKind,
      provider,
      operation,
      httpStatus: lastStatus,
      attempt,
      willRetry: attempt < maxAttempts,
      durationMs: Date.now() - attemptStarted,
    });

    if (attempt < maxAttempts) await sleep(backoffMs(attempt));
  }

  record(provider, breaker, false, lastKind, gate.probe, correlation);
  return {
    ok: false,
    kind: lastKind,
    status: lastStatus,
    error: lastError,
    attempts: attempt,
    durationMs: Date.now() - started,
  };
}
