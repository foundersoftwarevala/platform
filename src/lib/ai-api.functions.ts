import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function resolveSupabaseEnv() {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const env = typeof process !== "undefined" ? process.env : undefined;
  const url = viteEnv?.VITE_SUPABASE_URL ?? env?.SUPABASE_URL ?? "";
  const key =
    viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ??
    viteEnv?.VITE_SUPABASE_ANON_KEY ??
    env?.SUPABASE_PUBLISHABLE_KEY ??
    env?.SUPABASE_ANON_KEY ??
    env?.SUPABASE_SERVICE_ROLE_KEY ??
    "";

  if (!url || !key) {
    throw new Error("Missing Supabase environment configuration: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).")
  }

  return { url, key };
}

function publicClient() {
  const { url, key } = resolveSupabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export type AiRegistryService = {
  id: string;
  name: string;
  provider: string;
  route: string;
  owner: string;
  status: "active" | "warning" | "inactive";
  updated_at: string | null;
  usage_count: number;
  total_cost: number;
  error_count: number;
  last_error: string | null;
};

export type AiRegistrySnapshot = {
  services: AiRegistryService[];
  source: "supabase" | "fallback";
  summary: {
    active: number;
    warning: number;
    inactive: number;
    usage: number;
    cost: number;
    errors: number;
  };
};

function normalizeStatus(value: unknown): AiRegistryService["status"] {
  const v = String(value ?? "").toLowerCase();
  if (v === "active") return "active";
  if (v === "warning" || v === "degraded") return "warning";
  return "inactive";
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const listAiRegistry = createServerFn({ method: "GET" })
  .handler(async (): Promise<AiRegistrySnapshot> => {
    const sb = publicClient() as any;

    const [servicesResult, providersResult, usageResult] = await Promise.allSettled([
      sb.from("api_services").select("id, name, slug, provider_id, endpoint_url, status, owner_team, updated_at, avg_latency_ms").order("updated_at", { ascending: false }).limit(50),
      sb.from("ai_providers").select("id, name, slug").limit(50),
      sb.from("usage_events").select("service_id, requests, cost_usd, success, latency_ms, occurred_at").order("occurred_at", { ascending: false }).limit(500),
    ]);

    const servicesData = servicesResult.status === "fulfilled" && !servicesResult.value.error ? (servicesResult.value.data ?? []) : [];
    const providersData = providersResult.status === "fulfilled" && !providersResult.value.error ? (providersResult.value.data ?? []) : [];
    const usageRows = usageResult.status === "fulfilled" && !usageResult.value.error ? (usageResult.value.data ?? []) : [];
    const providersById = new Map(providersData.map((row: any) => [String(row.id), row]));

    const usageByService = new Map<string, { usage_count: number; total_cost: number; error_count: number; last_error: string | null }>();
    for (const row of usageRows) {
      const key = String(row.service_id ?? "");
      if (!key) continue;
      const current = usageByService.get(key) ?? { usage_count: 0, total_cost: 0, error_count: 0, last_error: null };
      current.usage_count += toNumber(row.requests);
      current.total_cost += toNumber(row.cost_usd);
      current.error_count += row.success === false ? 1 : 0;
      usageByService.set(key, current);
    }

    const services = (servicesData as Array<Record<string, unknown>>).map((row) => {
        const id = String(row.id ?? "");
        const usage = usageByService.get(id) ?? { usage_count: 0, total_cost: 0, error_count: 0, last_error: null };
        const provider = providersById.get(String(row.provider_id ?? ""));
        return {
          id,
          name: String(row.name ?? "AI service"),
          provider: String(provider?.name ?? "Registry"),
          route: String(row.endpoint_url ?? ""),
          owner: String(row.owner_team ?? "Platform"),
          status: normalizeStatus(row.status),
          updated_at: row.updated_at ? String(row.updated_at) : null,
          usage_count: usage.usage_count,
          total_cost: usage.total_cost,
          error_count: usage.error_count,
          last_error: usage.last_error ?? null,
        } satisfies AiRegistryService;
      });

    if (!services.length) {
      return {
        services: [],
        source: "fallback",
        summary: { active: 0, warning: 0, inactive: 0, usage: 0, cost: 0, errors: 0 },
      };
    }

    return {
      services,
      source: "supabase",
      summary: {
        active: services.filter((row) => row.status === "active").length,
        warning: services.filter((row) => row.status === "warning").length,
        inactive: services.filter((row) => row.status === "inactive").length,
        usage: services.reduce((acc, row) => acc + row.usage_count, 0),
        cost: services.reduce((acc, row) => acc + row.total_cost, 0),
        errors: services.reduce((acc, row) => acc + row.error_count, 0),
      },
    };
  });

/**
 * The one path to a model.
 *
 * AI API Manager holds the provider, the model, the credential and the record
 * of what was spent, so every request goes through here. A caller that built
 * its own client would be a second place to configure and a second place to
 * leak from, and its usage would never appear in the manager at all.
 *
 * It refuses rather than guessing: no active provider, or no real credential,
 * and it throws with the reason.
 */
export type AiRequest = {
  serviceId?: string;
  serviceName?: string;
  module?: string;
  system?: string;
  prompt?: string;
  payload?: Record<string, unknown>;
};

export async function executeAiRequest(data: AiRequest) {
  // This function used to carry its own copy of the provider / model /
  // credential resolution that lib/ai-gateway.server.ts already performs, and
  // the two had drifted: this one matched only category "llm" while the gateway
  // matched "ai" and "llm", so the same request could land on different
  // services depending on which entry point a module happened to use. There is
  // now one resolver. The signature and the returned shape are unchanged, so
  // every existing caller keeps working.
  const prompt = data.prompt ?? String(data.payload?.["prompt"] ?? "");
  if (!prompt.trim()) throw new Error("AI request prompt is required.");

  const { aiComplete } = await import("@/lib/ai-gateway.server");
  const result = await aiComplete({
    module: data.module ?? "sales-support",
    ...(data.serviceId ? { serviceId: data.serviceId } : {}),
    ...(data.serviceName ? { serviceName: data.serviceName } : {}),
    messages: [
      {
        role: "system",
        content: data.system ?? "You are a careful Sales & Support operations assistant.",
      },
      { role: "user", content: prompt },
    ],
  });

  return {
    text: result.text,
    service: result.service,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

/** The same routing, for a browser to call. */
export const routeAiRequest = createServerFn({ method: "POST" })
  .inputValidator((v) => z.object({
    serviceId: z.string().optional(),
    serviceName: z.string().optional(),
    module: z.string().optional(),
    system: z.string().optional(),
    prompt: z.string().optional(),
    payload: z.record(z.any()).optional(),
  }).parse(v ?? {}))
  .handler(async ({ data }) => executeAiRequest(data as AiRequest));
