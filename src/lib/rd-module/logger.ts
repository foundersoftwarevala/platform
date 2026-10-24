import { redactSensitiveData, redactSensitiveText } from "@/lib/error-redaction";

/**
 * Structured, level-aware logging for both browser and server runtimes.
 *
 * Every entry is emitted as a single JSON line so platform log pipelines can
 * group and filter by `level`, `scope` and `event` instead of scraping free
 * text. `logger.error` doubles as the app's error-reporting entry point:
 * point it at an external tracker (Sentry et al) in one place if needed.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const MIN_LEVEL: LogLevel = import.meta.env.DEV ? "debug" : "info";

export interface LogContext {
  /** Subsystem emitting the entry, e.g. "rnd.ai" or "pm.actions". */
  scope: string;
  /** Short machine-readable event name, e.g. "server_fn_failed". */
  event: string;
  [key: string]: unknown;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.cause ? { cause: serializeError(error.cause) } : {}),
    };
  }
  if (typeof error === "string") return { message: error };
  if (error == null) return {};
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function emit(level: LogLevel, context: LogContext, error?: unknown) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const entry = redactSensitiveData({
    level,
    time: new Date().toISOString(),
    runtime: typeof window === "undefined" ? "server" : "browser",
    ...context,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  });

  const line = (() => {
    try {
      return JSON.stringify(entry);
    } catch {
      return `{"level":"${level}","scope":"${redactSensitiveText(context.scope)}","event":"${redactSensitiveText(context.event)}","note":"unserializable log entry"}`;
    }
  })();

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (context: LogContext) => emit("debug", context),
  info: (context: LogContext) => emit("info", context),
  warn: (context: LogContext, error?: unknown) => emit("warn", context, error),
  error: (context: LogContext, error: unknown) => emit("error", context, error),
};

/** Normalizes any thrown value into a user-safe message. */
export function toMessage(error: unknown, fallback = "Unexpected error"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
