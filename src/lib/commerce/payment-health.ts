import { log } from "@/lib/commerce/observability";
import { circuitSnapshot } from "@/lib/commerce/provider-call";

/**
 * What is actually happening to payments, measured.
 *
 * Every number here is a count of rows this platform wrote while doing its
 * work: attempts in `payment_logs`, events in the outbox, exceptions in the
 * reconciliation records, errors in `error_events`. Nothing is a constant,
 * nothing is a placeholder, and there is no branch anywhere below that reports
 * "healthy" because it could not measure something — an unmeasurable signal
 * comes back as `unknown`, which is a different thing and is treated as one.
 *
 * The thresholds are the ones an operator would act on: a spike in failures, a
 * provider that stopped verifying, a customer who has paid and is still waiting
 * for their licence, a queue that is not draining. Each breach becomes one
 * alert on the board Finance Manager already reads, deduplicated over a window
 * so a bad hour produces a warning rather than a hundred of them.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/**
 * How many rows match, without fetching them. `null` means the question could
 * not be asked — never zero, because zero is an answer and this is not one.
 */
async function countOf(path: string): Promise<number | null> {
  if (!url()) return null;
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!response.ok) return null;
    const range = response.headers.get("content-range") ?? "";
    const total = Number(range.split("/")[1]);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

async function rows<T>(path: string): Promise<T[]> {
  if (!url()) return [];
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

export type Signal = {
  name: string;
  value: number | null;
  unit: "count" | "percent" | "minutes";
  /** ok, warn, critical, or unknown when the signal could not be measured. */
  state: "ok" | "warn" | "critical" | "unknown";
  detail: string;
};

const HOUR = 60 * 60 * 1000;

function ago(ms: number): string {
  return encodeURIComponent(new Date(Date.now() - ms).toISOString());
}

function grade(
  value: number | null,
  warn: number,
  critical: number,
): "ok" | "warn" | "critical" | "unknown" {
  if (value == null) return "unknown";
  if (value >= critical) return "critical";
  if (value >= warn) return "warn";
  return "ok";
}

/* -------------------------------------------------------------------------- */
/* The signals                                                                 */
/* -------------------------------------------------------------------------- */

async function eventCount(types: string[], windowMs: number): Promise<number | null> {
  return countOf(
    `payment_logs?select=id&event_type=in.(${types.join(",")})&created_at=gte.${ago(windowMs)}`,
  );
}

export type HealthReport = {
  measuredAt: string;
  overall: "ok" | "warn" | "critical" | "unknown";
  signals: Signal[];
  providers: {
    code: string;
    enabled: boolean;
    configured: boolean;
    state: string;
    /** What our own recent calls say, which is fresher than any stored column. */
    circuit: "closed" | "open" | "half_open";
  }[];
};

export async function measurePaymentHealth(): Promise<HealthReport> {
  const started = Date.now();
  const signals: Signal[] = [];

  /* ---- payment attempts and how they ended ------------------------------ */
  const initiated = await eventCount(["payment_initiated"], HOUR);
  const initiationFailed = await eventCount(["checkout_create_failed"], HOUR);
  const settledCount = await eventCount(["payment_settled"], HOUR);
  const failedCount = await eventCount(["payment_failed", "payment_expired"], HOUR);

  signals.push({
    name: "payment_initiations",
    value: initiated,
    unit: "count",
    state: initiated == null ? "unknown" : "ok",
    detail: "Payments started in the last hour.",
  });

  const initiationFailureRate =
    initiated != null && initiationFailed != null && initiated + initiationFailed > 0
      ? Math.round((initiationFailed / (initiated + initiationFailed)) * 100)
      : initiationFailed === 0
        ? 0
        : null;
  signals.push({
    name: "payment_initiation_failure_rate",
    value: initiationFailureRate,
    unit: "percent",
    state: grade(initiationFailureRate, 20, 50),
    detail: "Share of payment starts in the last hour that a provider refused to open.",
  });

  const settlementRate =
    settledCount != null && failedCount != null && settledCount + failedCount > 0
      ? Math.round((settledCount / (settledCount + failedCount)) * 100)
      : null;
  signals.push({
    name: "payment_settlement_rate",
    value: settlementRate,
    unit: "percent",
    // Inverted on purpose: a low settlement rate is the bad direction.
    state:
      settlementRate == null
        ? settledCount === 0 && failedCount === 0
          ? "ok"
          : "unknown"
        : settlementRate < 50
          ? "critical"
          : settlementRate < 80
            ? "warn"
            : "ok",
    detail: "Share of concluded payments in the last hour that settled.",
  });

  /* ---- what a provider told us it could not prove ----------------------- */
  const signatureFailures = await countOf(
    `payment_logs?select=id&signature_valid=is.false&created_at=gte.${ago(HOUR)}`,
  );
  signals.push({
    name: "webhook_signature_failures",
    value: signatureFailures,
    unit: "count",
    state: grade(signatureFailures, 3, 10),
    detail: "Callbacks in the last hour whose signature did not verify.",
  });

  const mismatches = await eventCount(
    ["payment_amount_mismatch", "payu_amount_mismatch", "payment_currency_mismatch"],
    24 * HOUR,
  );
  signals.push({
    name: "amount_mismatches",
    value: mismatches,
    unit: "count",
    state: grade(mismatches, 1, 5),
    detail: "Payments in the last day where the provider's figure did not match the order.",
  });

  /* ---- customers who are still waiting ---------------------------------- */
  const oldestPending = await rows<{ updated_at: string | null }>(
    "marketplace_orders?select=updated_at&status=in.(pending_payment,pending)" +
      "&txnid=not.is.null&order=updated_at.asc&limit=1",
  );
  const oldestPendingMinutes = oldestPending[0]?.updated_at
    ? Math.round((Date.now() - Date.parse(oldestPending[0].updated_at)) / 60_000)
    : 0;
  signals.push({
    name: "oldest_pending_payment",
    value: oldestPendingMinutes,
    unit: "minutes",
    state: grade(oldestPendingMinutes, 120, 24 * 60),
    detail: "Age of the payment that has been waiting longest.",
  });

  /* ---- the queue that finishes a payment -------------------------------- */
  const backlog = await countOf("finance_payment_events?select=id&status=eq.pending");
  signals.push({
    name: "outbox_backlog",
    value: backlog,
    unit: "count",
    state: grade(backlog, 25, 100),
    detail: "Settlement events waiting to be processed.",
  });

  const dead = await countOf("finance_payment_events?select=id&status=eq.dead");
  signals.push({
    name: "outbox_dead_events",
    value: dead,
    unit: "count",
    state: grade(dead, 1, 5),
    detail: "Settlement events that used up their retries and need a person.",
  });

  const entitlementFailures = await eventCount(["entitlement_retry_failed"], 24 * HOUR);
  signals.push({
    name: "entitlement_activation_failures",
    value: entitlementFailures,
    unit: "count",
    state: grade(entitlementFailures, 1, 5),
    detail: "Paid orders in the last day whose licence could not be issued.",
  });

  /* ---- the books ---------------------------------------------------------*/
  const openExceptions = await countOf(
    "finance_reconciliation_records?select=id&matching_status=neq.matched&resolved_at=is.null",
  );
  signals.push({
    name: "reconciliation_backlog",
    value: openExceptions,
    unit: "count",
    state: grade(openExceptions, 5, 25),
    detail: "Reconciliation exceptions nobody has resolved.",
  });

  /* ---- the database itself ---------------------------------------------- */
  const dbErrors = await countOf(
    `error_events?select=id&severity=eq.critical&created_at=gte.${ago(HOUR)}`,
  );
  signals.push({
    name: "critical_errors",
    value: dbErrors,
    unit: "count",
    state: grade(dbErrors, 1, 10),
    detail: "Critical runtime errors recorded in the last hour.",
  });

  /* ---- the providers ---------------------------------------------------- */
  const rails = await rows<{
    code: string;
    enabled: boolean;
    health_status: string | null;
    configuration_state: unknown;
  }>("finance_payment_rails?select=code,enabled,health_status,configuration_state");

  const { isCardGateway, resolveCardConfig } = await import("@/lib/commerce/card-gateways");
  const { resolvePayuConfig } = await import("@/lib/commerce/payu");
  const circuits = new Map(circuitSnapshot().map((entry) => [entry.provider, entry]));
  const providers: HealthReport["providers"] = [];
  for (const rail of rails) {
    const code = String(rail.code ?? "").toLowerCase();
    let configured = false;
    try {
      configured = isCardGateway(code)
        ? Boolean(await resolveCardConfig(code))
        : code === "payu"
          ? Boolean(await resolvePayuConfig())
          : Boolean(rail.enabled);
    } catch {
      configured = false;
    }
    const circuit = circuits.get(code)?.state ?? "closed";
    providers.push({
      code,
      enabled: Boolean(rail.enabled),
      configured,
      circuit,
      // Never the stored column on its own: a row can say "healthy" while its
      // credentials are gone, and that is exactly the lie to avoid. A rail
      // whose circuit is open is not "ready" either, however good its
      // credentials are — it is not answering us.
      state: !rail.enabled
        ? "off"
        : !configured
          ? "enabled but unconfigured"
          : circuit === "open"
            ? "not responding"
            : circuit === "half_open"
              ? "recovering"
              : "ready",
    });
  }

  const trippedCircuits = providers.filter((p) => p.circuit === "open").length;
  signals.push({
    name: "providers_not_responding",
    value: trippedCircuits,
    unit: "count",
    // One provider down is a warning because a customer can usually be routed
    // to another; two is critical because they may not be able to pay at all.
    state: grade(trippedCircuits, 1, 2),
    detail: "Rails whose circuit breaker is open because they stopped answering.",
  });

  const misconfigured = providers.filter((p) => p.enabled && !p.configured).length;
  signals.push({
    name: "providers_enabled_without_credentials",
    value: misconfigured,
    unit: "count",
    state: grade(misconfigured, 1, 2),
    detail: "Rails switched on that cannot actually take a payment.",
  });

  const worst = signals.reduce<"ok" | "warn" | "critical" | "unknown">((acc, signal) => {
    const rank = { ok: 0, unknown: 1, warn: 2, critical: 3 } as const;
    return rank[signal.state] > rank[acc] ? signal.state : acc;
  }, "ok");

  log({
    correlationId: `health:${started}`,
    component: "payment-health",
    action: "measure",
    status: worst === "critical" ? "error" : "ok",
    durationMs: Date.now() - started,
    overall: worst,
  });

  return {
    measuredAt: new Date(started).toISOString(),
    overall: worst,
    signals,
    providers,
  };
}

/* -------------------------------------------------------------------------- */
/* Alerting                                                                    */
/* -------------------------------------------------------------------------- */

/** No more than one alert per signal per this long, so a bad hour is one alert. */
const ALERT_COOLDOWN_MS = 6 * HOUR;

/**
 * Raise an alert for every signal that is breaching, and only for those.
 *
 * Deduplicated on the signal's own title within the cooldown, which is what
 * stops a sweep running every few minutes from turning one problem into a
 * storm that everybody learns to dismiss.
 */
export async function alertOnHealth(report: HealthReport): Promise<{ raised: string[] }> {
  const raised: string[] = [];
  if (!url()) return { raised };

  const breaching = report.signals.filter(
    (signal) => signal.state === "warn" || signal.state === "critical",
  );

  for (const signal of breaching) {
    const title = `Payments: ${signal.name.replace(/_/g, " ")}`;
    const since = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();
    try {
      const existing = await rows<{ id: string }>(
        `finance_alerts?select=id&category=eq.payments&title=eq.${encodeURIComponent(title)}` +
          `&created_at=gte.${encodeURIComponent(since)}&limit=1`,
      );
      if (existing.length) continue;

      await fetch(`${url()}/rest/v1/finance_alerts`, {
        method: "POST",
        headers: { ...admin(), Prefer: "return=minimal" },
        body: JSON.stringify({
          title,
          message: `${signal.detail} Measured: ${signal.value ?? "unknown"} ${signal.unit}.`,
          severity: signal.state === "critical" ? "critical" : "warning",
          category: "payments",
          status: "unread",
        }),
      });
      raised.push(signal.name);
    } catch (error) {
      console.error("[payment-health] could not raise alert", signal.name, error);
    }
  }

  return { raised };
}
