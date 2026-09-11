import { reportClientError } from "@/lib/error-monitor.functions";

// Installs global browser error monitoring: window errors, unhandled promise
// rejections, and console.error calls are forwarded to the server sink.
// Safe to call multiple times; installs once per page.

let installed = false;
const seen = new Map<string, number>();
const DEDUPE_MS = 30_000;
const MAX_PER_MINUTE = 20;
let windowStart = 0;
let sentInWindow = 0;

function throttled(key: string): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_PER_MINUTE) return true;
  const last = seen.get(key);
  if (last && now - last < DEDUPE_MS) return true;
  seen.set(key, now);
  sentInWindow += 1;
  return false;
}

/**
 * Query-string keys whose values must never reach the error log.
 *
 * The route is recorded so a failure can be located, and the query string is
 * part of that — knowing a crash happened on a product page with a particular
 * filter is often the whole diagnosis. But the payment return URLs are reached
 * with whatever the provider chose to append, and that is not ours to keep:
 * PayU's field set carries the buyer's first name, email and phone alongside a
 * response hash, and Flutterwave and Paystack append their own references and
 * signatures. Logging that verbatim writes a customer's contact details, and a
 * provider's signature, into `error_events`, where they are read by anyone with
 * access to the Error Monitor and kept for as long as the table is (§45).
 *
 * The value is replaced and the key is kept, because knowing *that* a signature
 * was present is diagnostic and knowing what it was is not.
 */
const REDACTED_PARAMS = new Set([
  "email",
  "firstname",
  "lastname",
  "name",
  "phone",
  "mobile",
  "address1",
  "address2",
  "hash",
  "signature",
  "token",
  "access_token",
  "code",
  "key",
  "apikey",
  "api_key",
  "password",
]);

/** How much of a query string is worth keeping at all. */
const MAX_QUERY_LENGTH = 300;

/**
 * The current route, with anything private taken out of its query string.
 *
 * Guarded end to end: this runs inside the error reporter, and a throw here
 * would mean a failure that swallows the report of another failure.
 */
export function safeRoute(): string {
  try {
    const path = window.location.pathname;
    const search = window.location.search;
    if (!search || search === "?") return path;

    const params = new URLSearchParams(search);
    const clean = new URLSearchParams();
    for (const [key, value] of params.entries()) {
      clean.set(key, REDACTED_PARAMS.has(key.toLowerCase()) ? "[redacted]" : value);
    }
    const query = clean.toString();
    // A query string long enough to matter is almost certainly carrying
    // something we did not put there; the path is the useful half either way.
    return query.length > MAX_QUERY_LENGTH ? path : `${path}?${query}`;
  } catch {
    try {
      return window.location.pathname;
    } catch {
      return "";
    }
  }
}

function send(
  message: string,
  stack: string | undefined,
  kind: "console" | "window_error" | "unhandled_rejection" | "boundary",
  severity: "warning" | "error" | "critical" = "error",
) {
  if (!message) return;
  if (throttled(`${kind}:${message.slice(0, 160)}`)) return;
  void reportClientError({
    data: {
      message: message.slice(0, 2000),
      ...(stack ? { stack: stack.slice(0, 8000) } : {}),
      route: safeRoute(),
      severity,
      kind,
    },
  }).catch(() => {
    /* monitoring must never surface its own failures */
  });
}

function describe(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) {
    return { message: value.message, ...(value.stack ? { stack: value.stack } : {}) };
  }
  if (typeof value === "string") return { message: value };
  try {
    return { message: JSON.stringify(value) ?? String(value) };
  } catch {
    return { message: String(value) };
  }
}

export function installClientErrorMonitor() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    const { message, stack } = describe(event.error ?? event.message);
    send(message, stack, "window_error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const { message, stack } = describe(event.reason);
    send(message, stack, "unhandled_rejection");
  });

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    const first = args.find((a) => a instanceof Error) ?? args[0];
    const { message, stack } = describe(first);
    send(message, stack, "console");
  };
}

export function reportBoundaryError(error: unknown) {
  const { message, stack } = describe(error);
  send(message, stack, "boundary", "critical");
}
