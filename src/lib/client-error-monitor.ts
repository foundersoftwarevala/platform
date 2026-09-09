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
      route: window.location.pathname + window.location.search,
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
