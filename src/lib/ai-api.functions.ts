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

export const routeAiRequest = createServerFn({ method: "POST" })
  .inputValidator((v) => z.object({
    serviceId: z.string().optional(),
    serviceName: z.string().optional(),
    module: z.string().optional(),
    system: z.string().optional(),
    prompt: z.string().optional(),
    payload: z.record(z.any()).optional(),
  }).parse(v ?? {}))
  .handler(async ({ data }) => {
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
  });
