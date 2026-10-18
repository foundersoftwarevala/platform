// Client-safe server-function entry point for manager-console analytics.
// Components import this module; the repository (.server.ts) is loaded only
// inside the handler body and is stripped from the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type { DashboardAnalytics, TimeRange } from "./types";

export type ModuleId = "creator" | "reseller" | "influencer" | "franchise" | "marketplace";

export const getModuleAnalytics = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        module: z
          .enum(["creator", "reseller", "influencer", "franchise", "marketplace"])
          .default("creator"),
        range: z.enum(["1d", "7d", "30d", "90d"]).default("7d"),
        scopeId: z.string().min(1).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<DashboardAnalytics> => {
    const { fetchDashboardAnalytics } = await import("./repository.server");
    return fetchDashboardAnalytics(data);
  });

export const moduleAnalyticsQueryOptions = (module: ModuleId, range: TimeRange = "7d") =>
  queryOptions({
    queryKey: ["module-analytics", module, range] as const,
    queryFn: () => getModuleAnalytics({ data: { module, range } }),
    // A server render carries no session, so it answers "not connected"; that
    // snapshot is stale at once so the signed-in browser asks again.
    staleTime: (query) => (query.state.data?.connected ? 60_000 : 0),
  });

/** Back-compat alias for the Creator Manager console. */
export const creatorAnalyticsQueryOptions = (range: TimeRange = "7d") =>
  moduleAnalyticsQueryOptions("creator", range);
