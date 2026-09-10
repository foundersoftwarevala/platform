// Client-safe server-function entry point for manager-console analytics.
// Components import this module; the repository (.server.ts) is loaded only
// inside the handler body and is stripped from the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type { DashboardAnalytics, TimeRange } from "./types";
import { emptyDashboardAnalytics } from "./types";

export type ModuleId = "creator" | "reseller" | "influencer" | "franchise" | "marketplace";

const MODULE_ROLES: Record<ModuleId, string[]> = {
  reseller: ["admin", "boss", "boss_owner", "founder", "owner", "super_admin", "finance", "support", "sales_support_manager"],
  creator: ["admin", "boss", "boss_owner", "founder", "owner", "super_admin", "marketing"],
  influencer: ["admin", "boss", "boss_owner", "founder", "owner", "super_admin", "marketing"],
  franchise: ["admin", "boss", "boss_owner", "founder", "owner", "super_admin", "finance", "support", "sales_support_manager"],
  marketplace: ["admin", "boss", "boss_owner", "founder", "owner", "super_admin", "marketing", "seo"],
};

function publishableKey(): string {
  return process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

async function requireAnalyticsRole(module: ModuleId, authToken?: string): Promise<Response | null> {
  const authorization =
    authToken
      ? `Bearer ${authToken}`
      : (getRequestHeader("authorization") ?? getRequestHeader("Authorization") ?? "");
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const publishable = publishableKey();
  const service = serviceKey();

  if (!url || !publishable || !service) {
    return Response.json({ error: "Analytics authorization is not configured" }, { status: 503 });
  }
  if (!authorization) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: authorization },
  });
  if (!userResponse.ok) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = (await userResponse.json()) as { id?: string };
  if (!user.id) return Response.json({ error: "Sign in required" }, { status: 401 });

  const rolesResponse = await fetch(
    `${url}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  if (!rolesResponse.ok) {
    return Response.json({ error: "Could not verify analytics access" }, { status: 503 });
  }

  const allowed = new Set(MODULE_ROLES[module]);
  const roles = (await rolesResponse.json()) as { role?: string }[];
  const canRead = roles.some((row) => allowed.has(String(row.role ?? "").trim().toLowerCase()));
  return canRead ? null : Response.json({ error: "Analytics access denied" }, { status: 403 });
}

export const getModuleAnalytics = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        module: z
          .enum(["creator", "reseller", "influencer", "franchise", "marketplace"])
          .default("creator"),
        range: z.enum(["1d", "7d", "30d", "90d"]).default("7d"),
        scopeId: z.string().min(1).optional(),
        authToken: z.string().min(1).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<DashboardAnalytics> => {
    const denied = await requireAnalyticsRole(data.module, data.authToken);
    if (denied) {
      if (denied.status === 401 || denied.status === 403) return emptyDashboardAnalytics(data.range);
      throw new Error((await denied.json() as { error?: string }).error ?? "Analytics access denied");
    }
    const { fetchDashboardAnalytics } = await import("./repository.server");
    return fetchDashboardAnalytics(data);
  });

export const moduleAnalyticsQueryOptions = (module: ModuleId, range: TimeRange = "7d") =>
  queryOptions({
    queryKey: ["module-analytics", module, range] as const,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      return getModuleAnalytics({
        data: { module, range, authToken: data.session?.access_token },
      });
    },
    staleTime: 60_000,
  });

/** Back-compat alias for the Creator Manager console. */
export const creatorAnalyticsQueryOptions = (range: TimeRange = "7d") =>
  moduleAnalyticsQueryOptions("creator", range);
