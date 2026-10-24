// Server-only error monitoring sink. Records runtime errors (server actions,
// SSR, and browser console errors) into public.error_events and escalates
// repeated or critical failures into public.security_alerts.

import { redactErrorMetadata, redactSensitiveText } from "@/lib/error-redaction";

export type ErrorSource = "server_fn" | "client" | "ssr";

export interface RecordErrorInput {
  source: ErrorSource;
  message: string;
  stack?: string | undefined;
  route?: string | undefined;
  fnName?: string | undefined;
  userAgent?: string | undefined;
  severity?: "warning" | "error" | "critical" | undefined;
  metadata?: Record<string, unknown> | undefined;
}

const MESSAGE_LIMIT = 2_000;
const STACK_LIMIT = 8_000;
// Repeated identical failures inside this window escalate to a security alert.
const BURST_WINDOW_MINUTES = 15;
const BURST_THRESHOLD = 5;

/** Stable grouping key: source + normalized message + first stack frame. */
export function fingerprint(input: RecordErrorInput): string {
  const normalized = redactSensitiveText(input.message)
    .replace(/0x[0-9a-f]+/gi, "0x")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\d+/g, "<n>")
    .trim()
    .slice(0, 200);
  const frame =
    redactSensitiveText(input.stack ?? "")
      .split("\n")[1]
      ?.trim()
      .slice(0, 160) ?? "";
  return `${input.source}|${redactSensitiveText(input.fnName ?? "")}|${normalized}|${frame}`;
}

export async function recordError(input: RecordErrorInput): Promise<{ ok: boolean }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeInput: RecordErrorInput = {
      ...input,
      message: redactSensitiveText(input.message),
      stack: input.stack === undefined ? undefined : redactSensitiveText(input.stack),
      route: input.route === undefined ? undefined : redactSensitiveText(input.route),
      fnName: input.fnName === undefined ? undefined : redactSensitiveText(input.fnName),
      userAgent: input.userAgent === undefined ? undefined : redactSensitiveText(input.userAgent),
      metadata: redactErrorMetadata(input.metadata ?? {}),
    };
    const fp = fingerprint(safeInput);
    const severity = input.severity ?? "error";

    const { error } = await supabaseAdmin.from("error_events").insert({
      source: safeInput.source,
      severity,
      fingerprint: fp,
      message: safeInput.message.slice(0, MESSAGE_LIMIT),
      stack: safeInput.stack?.slice(0, STACK_LIMIT) ?? null,
      route: safeInput.route ?? null,
      fn_name: safeInput.fnName ?? null,
      user_agent: safeInput.userAgent?.slice(0, 400) ?? null,
      metadata: safeInput.metadata as never,
    });
    if (error) {
      console.warn("[error-monitor] insert failed:", redactSensitiveText(error.message));
      return { ok: false };
    }

    await maybeAlert(supabaseAdmin, fp, safeInput, severity);
    return { ok: true };
  } catch (e) {
    // Monitoring must never break the request it is observing.
    console.warn(
      "[error-monitor] unavailable:",
      redactSensitiveText(e instanceof Error ? e.message : String(e)),
    );
    return { ok: false };
  }
}

type Admin =
  Awaited<
    ReturnType<typeof import("@/integrations/supabase/client.server").supabaseAdmin.from>
  > extends never
    ? never
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any;

async function maybeAlert(
  db: Admin,
  fp: string,
  input: RecordErrorInput,
  severity: string,
): Promise<void> {
  const since = new Date(Date.now() - BURST_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await db
    .from("error_events")
    .select("id", { count: "exact", head: true })
    .eq("fingerprint", fp)
    .gte("occurred_at", since);

  const burst = (count ?? 0) >= BURST_THRESHOLD;
  if (!burst && severity !== "critical") return;

  const title = burst
    ? `Repeated runtime error (${count}x/${BURST_WINDOW_MINUTES}m): ${input.message.slice(0, 90)}`
    : `Critical runtime error: ${input.message.slice(0, 100)}`;

  // De-duplicate: only one open alert per fingerprint at a time.
  const { data: existing } = await db
    .from("security_alerts")
    .select("id")
    .eq("status", "open")
    .eq("title", title)
    .limit(1);
  if (existing && existing.length > 0) return;

  await db.from("security_alerts").insert({
    title,
    severity: burst || severity === "critical" ? "high" : "medium",
    category: "reliability",
    source: input.source === "client" ? "browser" : "server",
    status: "open",
    description: `${input.fnName ? `Function: ${input.fnName}\n` : ""}${
      input.route ? `Route: ${input.route}\n` : ""
    }${input.message}`.slice(0, 2_000),
  });
}
