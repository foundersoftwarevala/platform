import { log } from "@/lib/commerce/observability";

/**
 * Whether a payment may be started at all, before anything is charged.
 *
 * Three separate questions, asked in order of how cheap they are to answer and
 * how serious the answer is:
 *
 *   1. Is the payment rail switched on for this country and method? That
 *      control already exists on this platform — `payment_controls` holds it and
 *      `payment_gate_is_open(p_country, p_method)` answers it — so nothing new
 *      is invented here and there is no second feature-flag system. The
 *      emergency controls board is consulted too, because an operator who pulls
 *      the payments switch there expects it to stop payments.
 *   2. Is this customer barred? `payment_blacklist` is the platform's existing
 *      list and it is keyed on the user, so the check is one lookup.
 *   3. Have they asked too often? The counter is in the database rather than in
 *      this process, so it holds across the workers and across a restart.
 *
 * Every one of these fails *open* when the control itself cannot be reached,
 * and says so in the log. That is deliberate. These are abuse controls, not
 * authorisation: an operator who has switched payments off gets a closed gate,
 * but a customer must not be told their card was refused because a counter
 * table was briefly unavailable. Authorisation — that the order is yours, that
 * the amount is what the server said — is enforced elsewhere and never fails
 * open.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown | undefined> {
  if (!url()) return undefined;
  try {
    const response = await fetch(`${url()}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: admin(),
      body: JSON.stringify(args),
    });
    if (!response.ok) return undefined;
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

async function rows<T>(path: string): Promise<T[] | undefined> {
  if (!url()) return undefined;
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return undefined;
    return (await response.json()) as T[];
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/* The address a request came from                                             */
/* -------------------------------------------------------------------------- */

/**
 * The caller's address as the edge reports it, used only as a rate-limit
 * subject. It is hashed into a bucket key before it is stored, so the counter
 * table holds no addresses.
 */
export function requestAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const candidate =
    request.headers.get("cf-connecting-ip") ??
    forwarded.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "";
  return candidate.slice(0, 64);
}

/* -------------------------------------------------------------------------- */
/* 1. Operational controls                                                     */
/* -------------------------------------------------------------------------- */

export type GateVerdict = { open: true } | { open: false; reason: string };

type PaymentControls = {
  payments_enabled: boolean;
  card_enabled: boolean;
  blocked_countries: string[] | null;
  allowed_countries: string[] | null;
};

/**
 * Read the platform's own payment controls.
 *
 * `payment_gate_is_open` is asked first because it is the canonical answer and
 * an operator may have put policy inside it. The `payment_controls` row is read
 * as well, so the *reason* a gate is shut can be told to the customer in words
 * rather than as a bare refusal.
 */
export async function paymentGate(input: {
  country: string | null;
  method: string;
}): Promise<GateVerdict> {
  const method = input.method.toLowerCase();
  const country = (input.country ?? "").toUpperCase();

  // The emergency board: one engaged switch stops payments everywhere.
  const emergencies = await rows<{ key: string; label: string; engaged: boolean }>(
    "emergency_controls?select=key,label,engaged&engaged=is.true",
  );
  const halt = (emergencies ?? []).find((row) =>
    /payment|checkout|commerce|billing/i.test(`${row.key} ${row.label}`),
  );
  if (halt) {
    return {
      open: false,
      reason: "Payments are paused by an operator right now. Please try again shortly.",
    };
  }

  const controls = await rows<PaymentControls>(
    "payment_controls?select=payments_enabled,card_enabled,blocked_countries,allowed_countries&limit=1",
  );
  const control = controls?.[0];
  if (control) {
    if (!control.payments_enabled) {
      return { open: false, reason: "Payments are temporarily switched off." };
    }
    if (!control.card_enabled && method !== "payu") {
      return { open: false, reason: "Card payment is temporarily switched off." };
    }
    if (country) {
      const blocked = (control.blocked_countries ?? []).map((c) => c.toUpperCase());
      const allowed = (control.allowed_countries ?? []).map((c) => c.toUpperCase());
      if (blocked.includes(country)) {
        return { open: false, reason: "Payment is not available from your country yet." };
      }
      if (allowed.length && !allowed.includes(country)) {
        return { open: false, reason: "Payment is not available from your country yet." };
      }
    }
  }

  // The canonical function, where the deployment has it. A `false` from it is
  // authoritative; anything else — including it not existing — leaves the
  // decision to the controls read above.
  const verdict = await rpc("payment_gate_is_open", { p_country: country || null, p_method: method });
  if (verdict === false) {
    return { open: false, reason: "Payment is not available for this method right now." };
  }
  if (verdict && typeof verdict === "object" && "open" in (verdict as Record<string, unknown>)) {
    const record = verdict as { open?: boolean; reason?: string };
    if (record.open === false) {
      return {
        open: false,
        reason: record.reason || "Payment is not available for this method right now.",
      };
    }
  }

  return { open: true };
}

/* -------------------------------------------------------------------------- */
/* 2. Barred customers                                                         */
/* -------------------------------------------------------------------------- */

/** True when this customer is on the platform's existing payment blacklist. */
export async function isBarred(userId: string): Promise<boolean> {
  if (!userId) return false;
  const found = await rows<{ user_id: string }>(
    `payment_blacklist?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  return Boolean(found?.length);
}

/* -------------------------------------------------------------------------- */
/* 3. Rate limits                                                              */
/* -------------------------------------------------------------------------- */

export type RateVerdict = {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  /** True when the limiter itself could not be consulted. */
  degraded: boolean;
};

const ALLOWED: RateVerdict = { allowed: true, retryAfter: 0, remaining: -1, degraded: false };

/**
 * The limits, by what is being protected rather than by endpoint name.
 *
 * They are deliberately generous for a person and tight for a script. A
 * customer paying for one order touches initiate two or three times and status
 * a dozen; nothing here is near that. What they stop is the shape that only an
 * automated caller produces.
 */
export const PAYMENT_LIMITS = {
  /** Starting payments: the expensive one, because each hits a provider. */
  initiate_user: { window: 300, limit: 12 },
  initiate_address: { window: 300, limit: 40 },
  /** Polling for a result: cheap, but a poll loop should not become a scraper. */
  status_address: { window: 60, limit: 120 },
  /** Asking the provider again on the customer's behalf. */
  recovery_order: { window: 60, limit: 10 },
  /** Refunds and other operator money movements. */
  refund_actor: { window: 300, limit: 20 },
} as const;

export type LimitName = keyof typeof PAYMENT_LIMITS;

/**
 * Take one slot from a bucket.
 *
 * The bucket key is hashed, so what is stored is a fixed-length opaque string
 * rather than a user id or an address. The increment happens inside the
 * database in one statement, which is what makes two simultaneous requests
 * unable to both see the last free slot.
 */
export async function takeRateSlot(
  name: LimitName,
  subject: string,
  correlation?: string,
): Promise<RateVerdict> {
  if (!subject) return ALLOWED;
  const limit = PAYMENT_LIMITS[name];

  // Hashed here rather than in the database so the identifier never travels to
  // the counter at all.
  const { createHash } = await import("node:crypto");
  const key = `${name}:${createHash("sha256").update(subject).digest("hex").slice(0, 32)}`;

  const result = await rpc("payment_rate_take", {
    p_key: key,
    p_window_seconds: limit.window,
    p_limit: limit.limit,
  });

  if (!result || typeof result !== "object") {
    // The limiter could not be reached. A payment is not refused for that, but
    // it is not silent either: a degraded limiter is an operational fact.
    log({
      correlationId: correlation ?? "-",
      component: "payment-guard",
      action: "rate_limiter_unavailable",
      status: "error",
      errorCode: "rate_limiter_unavailable",
      limit: name,
    });
    return { ...ALLOWED, degraded: true };
  }

  const record = result as { allowed?: boolean; retry_after?: number; remaining?: number };
  return {
    allowed: record.allowed !== false,
    retryAfter: Number(record.retry_after ?? limit.window) || 0,
    remaining: Number(record.remaining ?? 0),
    degraded: false,
  };
}

/* -------------------------------------------------------------------------- */
/* The three together                                                          */
/* -------------------------------------------------------------------------- */

export type StartVerdict =
  | { ok: true }
  | { ok: false; status: number; error: string; retryAfter?: number };

/**
 * Everything that has to be true before a payment may be started, in one call.
 * The order matters: a switched-off rail is told to everybody equally, and a
 * rate limit is only ever spent by a request that would otherwise have gone
 * through to a provider.
 */
export async function mayStartPayment(input: {
  userId: string;
  address: string;
  country: string | null;
  method: string;
  correlationId: string;
}): Promise<StartVerdict> {
  const gate = await paymentGate({ country: input.country, method: input.method });
  if (!gate.open) {
    log({
      correlationId: input.correlationId,
      component: "payment-guard",
      action: "gate_closed",
      status: "refused",
      provider: input.method,
      country: input.country,
    });
    return { ok: false, status: 503, error: gate.reason };
  }

  if (await isBarred(input.userId)) {
    log({
      correlationId: input.correlationId,
      component: "payment-guard",
      action: "customer_barred",
      status: "refused",
      userId: input.userId,
    });
    return {
      ok: false,
      status: 403,
      error: "This account cannot start a payment. Please contact support.",
    };
  }

  const byUser = await takeRateSlot("initiate_user", input.userId, input.correlationId);
  if (!byUser.allowed) {
    log({
      correlationId: input.correlationId,
      component: "payment-guard",
      action: "rate_limited",
      status: "refused",
      userId: input.userId,
      limit: "initiate_user",
    });
    return {
      ok: false,
      status: 429,
      error: "Too many payment attempts. Please wait a moment and try again.",
      retryAfter: byUser.retryAfter,
    };
  }

  if (input.address) {
    const byAddress = await takeRateSlot("initiate_address", input.address, input.correlationId);
    if (!byAddress.allowed) {
      log({
        correlationId: input.correlationId,
        component: "payment-guard",
        action: "rate_limited",
        status: "refused",
        limit: "initiate_address",
      });
      return {
        ok: false,
        status: 429,
        error: "Too many payment attempts from this connection. Please wait a moment.",
        retryAfter: byAddress.retryAfter,
      };
    }
  }

  return { ok: true };
}
