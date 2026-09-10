import { randomUUID } from "node:crypto";

/**
 * One thread to pull on when a customer says "I paid and nothing happened".
 *
 * A payment crosses a lot of ground: the browser calls initiate, the provider
 * hosts a checkout, a webhook arrives from somewhere else entirely, a status
 * poll comes back later, and a background job finishes the job days after. Each
 * of those wrote its own log line and none of them shared a key, so tying them
 * together afterwards meant guessing from timestamps.
 *
 * A correlation id fixes that. It is minted at the first request that touches a
 * payment, echoed back in the response header, carried into the payment
 * reference's own log rows, committed onto the outbox event inside the
 * settlement transaction, and picked up again by whichever worker processes
 * that event. One id, from the click to the licence.
 *
 * What is never in one of these lines: a card number, a CVV, an API secret, a
 * password, a one-time code, or a bank credential. The redactor below is not a
 * suggestion — it runs over every payload before it is written.
 */

/** Headers a proxy or an earlier hop may already have set. */
const INBOUND_HEADERS = [
  "x-correlation-id",
  "x-request-id",
  "cf-ray",
  "x-amzn-trace-id",
] as const;

export const CORRELATION_HEADER = "x-correlation-id";

/** Safe to put in a log and in a response: opaque, bounded, no user content. */
function sanitiseId(value: string): string {
  return value.replace(/[^A-Za-z0-9_:.-]/g, "").slice(0, 80);
}

/**
 * The correlation id for this request: whatever the edge already assigned, or a
 * fresh one. Reusing the inbound value is what makes a Cloudflare ray id and
 * our own logs line up without a second lookup.
 */
export function correlationId(request?: Request | null): string {
  if (request) {
    for (const header of INBOUND_HEADERS) {
      const value = request.headers.get(header);
      if (value) {
        const clean = sanitiseId(value);
        if (clean) return clean;
      }
    }
  }
  return `cid_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

/* -------------------------------------------------------------------------- */
/* Redaction                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Field names that must never reach a log, whatever the value looks like.
 * Matched on the key rather than the content, because a secret does not
 * announce itself.
 */
const FORBIDDEN_KEY = new RegExp(
  [
    "pass(word|phrase)?",
    "secret",
    "salt",
    "token",
    "api[_-]?key",
    "authorization",
    "cookie",
    "cvv",
    "cvc",
    "csc",
    "card[_-]?number",
    "pan",
    "expiry",
    "exp[_-]?(month|year)",
    "iban",
    "account[_-]?number",
    "routing",
    "ifsc",
    "swift",
    "otp",
    "pin",
    "private[_-]?key",
    "signature",
    "hash",
  ].join("|"),
  "i",
);

/** A bare card-shaped number anywhere in a string, whatever the field is called. */
const CARD_SHAPED = /\b(?:\d[ -]*?){13,19}\b/g;

function redactString(value: string): string {
  // Keep the last four, which is the only part of a card this platform is ever
  // allowed to hold, and only where a provider volunteered it.
  return value.replace(CARD_SHAPED, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13) return match;
    return `****${digits.slice(-4)}`;
  });
}

/**
 * A payload with everything unloggable taken out. Depth-bounded, so a payload
 * that references itself cannot spin, and size-bounded so one enormous provider
 * body cannot fill the log table.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (value == null) return value;
  if (typeof value === "string") return redactString(value).slice(0, 2_000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    let seen = 0;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (seen++ >= 60) {
        out["…"] = "[truncated]";
        break;
      }
      out[key] = FORBIDDEN_KEY.test(key) ? "[redacted]" : redact(item, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 500);
}

/* -------------------------------------------------------------------------- */
/* Structured logging                                                          */
/* -------------------------------------------------------------------------- */

export type LogFields = {
  correlationId: string;
  component: string;
  action: string;
  status?: "ok" | "error" | "refused" | "replay";
  errorCode?: string;
  durationMs?: number;
  userId?: string | null;
  orderId?: string | null;
  reference?: string | null;
  provider?: string | null;
  [key: string]: unknown;
};

/**
 * One line, one JSON object, every field safe.
 *
 * It goes to stdout because that is what PM2 already captures on this server;
 * nothing new has to be installed for these to be greppable, and a log shipper
 * added later will find them already structured.
 */
export function log(fields: LogFields): void {
  const line = {
    ts: new Date().toISOString(),
    level: fields.status === "error" ? "error" : "info",
    ...(redact(fields) as Record<string, unknown>),
  };
  const text = JSON.stringify(line);
  if (line.level === "error") console.error(text);
  else console.log(text);
}

/** Milliseconds since a start mark, rounded — for the duration field. */
export function since(start: number): number {
  return Math.max(0, Math.round(Date.now() - start));
}

/** Attach the correlation id to a response so the caller can quote it to support. */
export function withCorrelation(response: Response, id: string): Response {
  try {
    response.headers.set(CORRELATION_HEADER, id);
  } catch {
    // A frozen response is not worth failing a payment over.
  }
  return response;
}
