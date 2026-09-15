import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
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
    throw new Error(
      "Missing Supabase environment configuration: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).",
    );
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
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
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
  category: string;
  pricing_tier: string;
  approval_status: string;
  capabilities: string[];
  credential_status: "configured" | "required" | "not_required" | "unknown";
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

export const listAiRegistry = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiRegistrySnapshot> => {
    const sb = publicClient() as any;

    const [richServicesResult, providersResult, usageResult, capabilitiesResult] =
      await Promise.allSettled([
        sb
          .from("api_services")
          .select(
            "id, name, slug, provider_id, endpoint_url, status, owner_team, category, pricing_tier, approval_status, capabilities, updated_at, avg_latency_ms",
          )
          .order("updated_at", { ascending: false })
          .limit(100),
        sb.from("ai_providers").select("id, name, slug").limit(50),
        sb
          .from("usage_events")
          .select("service_id, requests, cost_usd, success, latency_ms, occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(500),
        sb
          .from("api_service_capabilities")
          .select("service_id, capability_name, approval_status, verification_status")
          .limit(500),
      ]);

    let servicesData =
      richServicesResult.status === "fulfilled" && !richServicesResult.value.error
        ? (richServicesResult.value.data ?? [])
        : [];
    if (
      !servicesData.length &&
      richServicesResult.status === "fulfilled" &&
      richServicesResult.value.error
    ) {
      const legacy = await sb
        .from("api_services")
        .select(
          "id, name, slug, provider_id, endpoint_url, status, owner_team, created_at, avg_latency_ms",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (!legacy.error) servicesData = legacy.data ?? [];
    }
    const providersData =
      providersResult.status === "fulfilled" && !providersResult.value.error
        ? (providersResult.value.data ?? [])
        : [];
    const usageRows =
      usageResult.status === "fulfilled" && !usageResult.value.error
        ? (usageResult.value.data ?? [])
        : [];
    const providersById = new Map(providersData.map((row: any) => [String(row.id), row]));
    const capabilitiesByService = new Map<string, string[]>();
    if (capabilitiesResult.status === "fulfilled" && !capabilitiesResult.value.error) {
      for (const capability of capabilitiesResult.value.data ?? []) {
        const serviceId = String(capability.service_id);
        const label = String(capability.capability_name ?? "Capability");
        const state = `${capability.approval_status ?? "pending"}/${capability.verification_status ?? "unverified"}`;
        capabilitiesByService.set(serviceId, [
          ...(capabilitiesByService.get(serviceId) ?? []),
          `${label} (${state})`,
        ]);
      }
    }

    const usageByService = new Map<
      string,
      { usage_count: number; total_cost: number; error_count: number; last_error: string | null }
    >();
    for (const row of usageRows) {
      const key = String(row.service_id ?? "");
      if (!key) continue;
      const current = usageByService.get(key) ?? {
        usage_count: 0,
        total_cost: 0,
        error_count: 0,
        last_error: null,
      };
      current.usage_count += toNumber(row.requests);
      current.total_cost += toNumber(row.cost_usd);
      current.error_count += row.success === false ? 1 : 0;
      usageByService.set(key, current);
    }

    const services = (servicesData as Array<Record<string, unknown>>).map((row) => {
      const id = String(row.id ?? "");
      const usage = usageByService.get(id) ?? {
        usage_count: 0,
        total_cost: 0,
        error_count: 0,
        last_error: null,
      };
      const provider = providersById.get(String(row.provider_id ?? ""));
      return {
        id,
        name: String(row.name ?? "AI service"),
        provider: String(provider?.name ?? "Registry"),
        route: String(row.endpoint_url ?? ""),
        owner: String(row.owner_team ?? "Platform"),
        category: String(row.category ?? "general"),
        pricing_tier: String(row.pricing_tier ?? "unknown"),
        approval_status: String(row.approval_status ?? "pending"),
        capabilities:
          capabilitiesByService.get(id) ??
          (Array.isArray(row.capabilities) ? row.capabilities.map(String) : []),
        credential_status: row.credential_env || row.status === "active" ? "unknown" : "required",
        status: normalizeStatus(row.status),
        updated_at: row.updated_at
          ? String(row.updated_at)
          : row.created_at
            ? String(row.created_at)
            : null,
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
  },
);

async function authenticatedManager() {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Manager authentication required.");
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase service configuration is missing.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error } = await db.auth.getUser(token);
  if (error || !user.user) throw new Error("Manager authentication required.");
  const roles = await Promise.all(
    ["admin", "boss"].map(async (role) => {
      const result = await db.rpc("has_role", { _user_id: user.user.id, _role: role });
      return result.data === true;
    }),
  );
  if (!roles.some(Boolean)) throw new Error("Boss or admin permission required.");
  return { db, user: user.user };
}

export const testAiService = createServerFn({ method: "POST" })
  .inputValidator((value) => z.object({ serviceId: z.string().uuid() }).parse(value))
  .handler(async ({ data }) => {
    const { db } = await authenticatedManager();
    const { data: service, error } = await db
      .from("api_services")
      .select("id, name, status, approval_status, credential_env")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (error || !service) {
      const legacy = await db
        .from("api_services")
        .select("id, name, status")
        .eq("id", data.serviceId)
        .maybeSingle();
      if (legacy.error || !legacy.data) throw new Error("Service is not registered.");
      return {
        serviceId: legacy.data.id,
        status: "blocked" as const,
        detail:
          "BLOCKED / CREDENTIAL REQUIRED. Registry metadata is not deployed yet; no provider request was sent.",
      };
    }
    const credentialEnv =
      typeof service.credential_env === "string" ? service.credential_env : null;
    const credentialConfigured = Boolean(
      credentialEnv && /^[A-Z][A-Z0-9_]{2,63}$/.test(credentialEnv) && process.env[credentialEnv],
    );
    return {
      serviceId: service.id,
      status: "blocked" as const,
      detail: credentialConfigured
        ? "BLOCKED / EXECUTION ADAPTER REQUIRED. A provider-specific central gateway adapter is required before a live test request can be sent."
        : "BLOCKED / CREDENTIAL REQUIRED. No server credential is configured; no provider request was sent.",
    };
  });

export const setAiServiceStatus = createServerFn({ method: "POST" })
  .inputValidator((value) =>
    z
      .object({
        serviceId: z.string().uuid(),
        enabled: z.boolean(),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { db, user } = await authenticatedManager();
    const { data: service, error: readError } = await db
      .from("api_services")
      .select("id, name, approval_status, credential_env")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (readError || !service) throw new Error("Service is not registered.");
    if (data.enabled && service.approval_status !== "approved") {
      throw new Error("Approve this service before enabling it.");
    }
    const { error } = await db
      .from("api_services")
      .update({
        status: data.enabled ? "active" : "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.serviceId);
    if (error) throw new Error(error.message);
    await db.from("audit_logs").insert({
      actor: user.email ?? user.id,
      action: data.enabled ? "API_SERVICE_ENABLED" : "API_SERVICE_DISABLED",
      entity_type: "api_services",
      entity_id: data.serviceId,
      severity: "info",
      metadata: { service_name: service.name },
    });
    return { ok: true, enabled: data.enabled };
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
    const { url } = resolveSupabaseEnv();
    const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
    const sb = createClient(url, serverKey || resolveSupabaseEnv().key, { auth: { persistSession: false } }) as any;
    let target: { id: string; name: string; provider: string; route: string; status: string; providerId: string | null } | null = null;
    if (data.serviceId) {
      const { data: row } = await sb.from("api_services").select("id, name, provider_id, endpoint_url, status").eq("id", data.serviceId).maybeSingle();
      if (row) target = { id: row.id, name: row.name, provider: "", route: row.endpoint_url, status: row.status, providerId: row.provider_id };
      else {
        throw new Error("The selected AI service is not registered in AI API Manager.");
      }
    } else if (data.serviceName) {
      const { data: rows } = await sb.from("api_services").select("id, name, provider_id, endpoint_url, status").ilike("name", `%${data.serviceName}%`).order("updated_at", { ascending: false }).limit(1);
      const row = rows?.[0];
      if (row) target = { id: row.id, name: row.name, provider: "", route: row.endpoint_url, status: row.status, providerId: row.provider_id };
    } else {
      const { data: rows } = await sb.from("api_services").select("id, name, provider_id, endpoint_url, status").eq("status", "active").eq("category", "llm").order("updated_at", { ascending: false }).limit(1);
      const row = rows?.[0];
      if (row) target = { id: row.id, name: row.name, provider: "", route: row.endpoint_url, status: row.status, providerId: row.provider_id };
    }

    if (!target || target.status !== "active") throw new Error("No active AI provider is configured in AI API Manager.");
    if (!target.route) throw new Error(`AI service ${target.name} has no execution endpoint configured.`);

    const { data: provider } = await sb.from("ai_providers").select("name, slug").eq("id", target.providerId).maybeSingle();
    const providerSlug = String(provider?.slug ?? provider?.name ?? target.name).toLowerCase();
    const { data: model } = await sb.from("ai_models").select("id, model_id").eq("provider_id", target.providerId).eq("status", "active").eq("is_default", true).maybeSingle();
    const { data: keyRows } = await sb.from("api_keys").select("secret_encrypted, status, environment").eq("service_id", target.id).eq("status", "active").eq("environment", "production").limit(1);
    const envKey = providerSlug.includes("anthropic") ? process.env.ANTHROPIC_API_KEY : providerSlug.includes("google") ? process.env.GOOGLE_API_KEY : process.env.OPENAI_API_KEY;
    const storedKey = keyRows?.[0]?.secret_encrypted;
    const credential = envKey || (typeof storedKey === "string" && /^(sk-|key-|AIza|anthropic)/i.test(storedKey) ? storedKey : "");
    if (!credential) throw new Error(`No real production credential is configured for ${target.name}. Add it in AI API Manager or server environment.`);

    const prompt = data.prompt ?? String(data.payload?.prompt ?? "");
    if (!prompt.trim()) throw new Error("AI request prompt is required.");
    const started = Date.now();
    const isAnthropic = providerSlug.includes("anthropic");
    const headers: Record<string, string> = { "content-type": "application/json" };
    let body: Record<string, unknown>;
    if (isAnthropic) {
      headers["x-api-key"] = credential;
      headers["anthropic-version"] = "2023-06-01";
      body = { model: model?.model_id ?? "claude-3-5-sonnet-latest", max_tokens: 1200, system: data.system, messages: [{ role: "user", content: prompt }] };
    } else {
      headers.authorization = `Bearer ${credential}`;
      body = { model: model?.model_id ?? "gpt-4o-mini", temperature: 0.2, max_tokens: 1200, messages: [{ role: "system", content: data.system ?? "You are a careful Sales & Support operations assistant." }, { role: "user", content: prompt }] };
    }
    const response = await fetch(target.route, { method: "POST", headers, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})) as Record<string, any>;
    const latency = Date.now() - started;
    const output = isAnthropic ? result.content?.find((item: any) => item.type === "text")?.text : result.choices?.[0]?.message?.content;
    await sb.from("usage_events").insert({ service_id: target.id, model_id: model?.id ?? null, product: data.module ?? "sales-support", requests: 1, tokens_in: result.usage?.input_tokens ?? result.usage?.prompt_tokens ?? 0, tokens_out: result.usage?.output_tokens ?? result.usage?.completion_tokens ?? 0, latency_ms: latency, status_code: response.status, success: response.ok, source: "ai-api-manager" });
    if (!response.ok || !output) throw new Error(result.error?.message ?? result.error?.[0]?.message ?? `AI provider returned HTTP ${response.status}.`);
    return { text: String(output), service: target.name, provider: provider?.name ?? target.provider, model: model?.model_id ?? null, latencyMs: latency };
}

/** The same routing, for a browser to call. */
export const routeAiRequest = createServerFn({ method: "POST" })
  .inputValidator((v) =>
    z
      .object({
        serviceId: z.string().optional(),
        serviceName: z.string().optional(),
        module: z.string().optional(),
        system: z.string().optional(),
        prompt: z.string().optional(),
        payload: z.record(z.any()).optional(),
      })
      .parse(v ?? {}),
  )
  .handler(async ({ data }) => {
    const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new Error("Authentication required for AI routing.");

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
    if (!url || !key) throw new Error("Supabase is not configured on the server.");
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: user, error } = await db.auth.getUser(token);
    if (error || !user.user) throw new Error("Authentication required for AI routing.");

    const roleChecks = await Promise.all(
      ["admin", "boss", "developer", "seo", "marketing"].map(async (role) => {
        const result = await db.rpc("has_role", { _user_id: user.user.id, _role: role });
        return result.data === true;
      }),
    );
    if (!roleChecks.some(Boolean)) throw new Error("AI routing permission required.");

    // The browser may request a prompt, but it cannot choose a privileged
    // module identity. Manager traffic is attributed to this controlled route.
    return executeAiRequest({ ...(data as AiRequest), module: "ai-api-manager" });
  });
