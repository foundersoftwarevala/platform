import { browserTimezone, formatInTz } from "@/lib/timezone";

/**
 * Display helpers for the pages a customer sees: their purchases, the checkout
 * and the page they land on after paying.
 *
 * These exist because the customer portal is multi-currency and Finance
 * Manager's formatter is not. `lib/finance/format.ts` is hard-wired to INR
 * because Finance Manager reports in one reporting currency — correct there,
 * and quietly wrong here, where a customer may be charged in USD, EUR, GBP or
 * NGN and must be shown the currency they were actually charged in. So this is
 * not a second copy of that formatter; it is the one place that handles a
 * currency the server chose rather than one we assumed.
 *
 * The rule the whole file follows: never invent a value. A missing amount is an
 * em dash, not a zero. An unparseable date is an em dash, not "Invalid Date".
 * An unknown currency is shown as its own code rather than being decorated with
 * a dollar sign that would be a lie for most of the world.
 */

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * An amount, in the currency the server said it was charged in.
 *
 * The currency code is authoritative and always comes from backend data — it is
 * never inferred, and no symbol is ever assumed. The locale is the reader's own,
 * which is what decides digit grouping and separators; the currency decides the
 * symbol and how many decimal places it has. That pairing matters: formatting a
 * dollar amount with Indian grouping produces "$1,23,456.78", and forcing zero
 * decimals onto an invoice hides the cents a customer was actually charged.
 */
export function money(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (value == null || !Number.isFinite(value)) return "—";

  const code = String(currency ?? "").trim().toUpperCase();
  if (!code) {
    // No currency is not an invitation to guess one. Show the number plainly.
    try {
      return new Intl.NumberFormat(undefined).format(value);
    } catch {
      return String(value);
    }
  }

  try {
    // Intl knows each currency's own decimal convention — two for USD, none for
    // JPY — so it is left to decide rather than being told.
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(value);
  } catch {
    // An unrecognised or malformed code. The number and the code are both true;
    // a symbol would not be.
    try {
      return `${code} ${new Intl.NumberFormat(undefined).format(value)}`;
    } catch {
      return `${code} ${value}`;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * When something happened, in the reader's own zone and saying so.
 *
 * Timestamps are stored and travel in UTC. What was wrong before was not that
 * the browser's zone was used, but that it was used *silently* — a customer in
 * Sydney and one in London saw different dates for the same order with nothing
 * on screen to explain it. Naming the zone removes that ambiguity, which is the
 * thing that actually causes a support ticket.
 *
 * `formatInTz` already does this and already returns an em dash for anything it
 * cannot parse, so it is reused rather than reimplemented.
 */
export function whenLabel(iso: string | null | undefined): string {
  return formatInTz(iso, browserTimezone());
}

/** The same instant, date only, for places too narrow for a full timestamp. */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: browserTimezone(),
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
}

/* -------------------------------------------------------------------------- */
/* Reading a response                                                          */
/* -------------------------------------------------------------------------- */

export type JsonResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

/**
 * Read a JSON response without ever letting the page die on the answer.
 *
 * Three things go wrong in production that a bare `await response.json()` turns
 * into a crash or a baffling message. A proxy or an error page returns HTML, so
 * the parse throws "Unexpected token <". The response is empty, so the parse
 * throws on nothing at all. Or the request never completes and `fetch` itself
 * rejects. All three arrive here as an ordinary result with a sentence a
 * customer can act on.
 *
 * The status is kept alongside, because how a caller should react to 401 is not
 * how it should react to 502.
 */
export async function readJson<T>(response: Response): Promise<JsonResult<T>> {
  let body = "";
  try {
    body = await response.text();
  } catch {
    return { ok: false, status: response.status, error: friendlyError(response.status) };
  }

  if (!body.trim()) {
    return response.ok
      ? ({ ok: true, status: response.status, data: {} as T })
      : { ok: false, status: response.status, error: friendlyError(response.status) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Almost always an HTML error page from something in front of the app.
    return { ok: false, status: response.status, error: friendlyError(response.status) };
  }

  if (!response.ok) {
    const message = (parsed as { error?: unknown } | null)?.error;
    return {
      ok: false,
      status: response.status,
      error: safeMessage(message) ?? friendlyError(response.status),
    };
  }

  return { ok: true, status: response.status, data: parsed as T };
}

/* -------------------------------------------------------------------------- */
/* Errors a customer should see                                                */
/* -------------------------------------------------------------------------- */

/**
 * Signs that a string is a developer's error rather than a customer's.
 *
 * The server's own refusals are written for customers — "Please sign in to
 * pay.", "That order is already paid." — and passing those straight through is
 * the whole point. What must never reach a customer is the other kind: a stack
 * frame, a driver message, a URL, a SQL fragment. This is a deliberately blunt
 * filter, and it errs towards replacing a message rather than showing one it is
 * unsure about.
 */
const TECHNICAL = [
  /\bat\s+\w+\s*\(/i, // a stack frame
  /\b(?:https?|postgres|postgresql):\/\//i,
  /\b(?:select|insert|update|delete)\s+.*\b(?:from|into|set)\b/i,
  /\b(?:supabase|postgrest|pgrst|nitro|vite|econnrefused|etimedout|enotfound|fetch failed)\b/i,
  /\b(?:typeerror|referenceerror|syntaxerror|rangeerror)\b/i,
  /\bundefined is not\b|\bcannot read propert/i,
  /[{}[\]]/, // a serialised object or array
];

/** A server message if it is fit to show, otherwise nothing. */
export function safeMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > 200) return null;
  if (TECHNICAL.some((pattern) => pattern.test(text))) return null;
  return text;
}

/**
 * What to say when there is nothing safe to quote, chosen by status so the
 * customer is told something true about what to do next.
 */
export function friendlyError(status: number): string {
  if (status === 401) return "Please sign in and try again.";
  if (status === 403) return "This does not belong to your account.";
  if (status === 404) return "We could not find that.";
  if (status === 409) return "That has already been done.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status === 503) return "This is temporarily unavailable. Please try again shortly.";
  if (status >= 500) return "Something went wrong on our end. Please try again shortly.";
  if (status >= 400) return "That request could not be completed.";
  return "Something went wrong. Please try again.";
}

/**
 * The same judgement applied to a thrown error rather than a response, for the
 * `catch` at the end of a mutation. A network failure is named as one, because
 * "failed to fetch" tells a customer nothing.
 */
export function friendlyThrown(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "That took too long and was stopped. Nothing was charged.";
  }
  if (error instanceof TypeError) {
    return "We could not reach the server. Check your connection and try again.";
  }
  if (error instanceof Error) {
    return safeMessage(error.message) ?? fallback;
  }
  return fallback;
}
