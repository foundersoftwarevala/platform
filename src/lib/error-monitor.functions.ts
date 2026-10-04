import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { SlidingWindowLimiter, clientAddress } from "@/lib/i18n/limits";

const reportSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  route: z.string().max(300).optional(),
  severity: z.enum(["warning", "error", "critical"]).default("error"),
  kind: z.enum(["console", "window_error", "unhandled_rejection", "boundary"]).default("console"),
});

/**
 * This sink is public - any browser, signed in or not, reports through it - and
 * it writes with the service role. Without a limit one address could fill
 * error_events, and every distinct "critical" message opened its own security
 * alert in the operators' console. Reports are now limited per address, and a
 * browser's own word that something is critical is recorded as an error: an
 * alert still opens when the same failure repeats (the burst rule).
 */
const reportLimiter = new SlidingWindowLimiter(60_000, 10_000);
const REPORTS_PER_MINUTE = 30;

/** Browser -> server sink for client console/runtime errors. */
export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reportSchema.parse(data))
  .handler(async ({ data }) => {
    const { recordError } = await import("./error-monitor.server");
    const { getRequestHeader, getRequest } = await import("@tanstack/react-start/server");
    const headers = getRequest()?.headers ?? new Headers();
    if (reportLimiter.hit(clientAddress(headers), REPORTS_PER_MINUTE)) return { ok: false };
    return recordError({
      source: "client",
      message: data.message,
      stack: data.stack,
      route: data.route,
      severity: data.severity === "critical" ? "error" : data.severity,
      userAgent: getRequestHeader("user-agent") ?? undefined,
      metadata: { kind: data.kind, reported_severity: data.severity },
    });
  });
