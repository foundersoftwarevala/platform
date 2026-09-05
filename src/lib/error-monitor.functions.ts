import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const reportSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  route: z.string().max(300).optional(),
  severity: z.enum(["warning", "error", "critical"]).default("error"),
  kind: z.enum(["console", "window_error", "unhandled_rejection", "boundary"]).default("console"),
});

/** Browser -> server sink for client console/runtime errors. */
export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reportSchema.parse(data))
  .handler(async ({ data }) => {
    const { recordError } = await import("./error-monitor.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    return recordError({
      source: "client",
      message: data.message,
      stack: data.stack,
      route: data.route,
      severity: data.severity,
      userAgent: getRequestHeader("user-agent") ?? undefined,
      metadata: { kind: data.kind },
    });
  });
