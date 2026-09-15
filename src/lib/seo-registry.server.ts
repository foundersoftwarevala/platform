import { createClient } from "@supabase/supabase-js";

import { decryptAiCredential } from "./ai-credentials.server";

type CentralSeoService = {
  id: string;
  name: string;
  endpoint_url: string | null;
  status: string;
  approval_status: string;
  credential_env: string | null;
};

function serverClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase service configuration is missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function readEnvironmentCredential(name: string | null): string | null {
  if (!name || !/^[A-Z][A-Z0-9_]{2,63}$/.test(name)) return null;
  return process.env[name]?.trim() || null;
}

export async function resolveCentralSeoService(slug: string) {
  const db = serverClient();
  const { data, error } = await db
    .from("api_services")
    .select("id, name, endpoint_url, status, approval_status, credential_env")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) throw new Error(`SEO service '${slug}' is not registered in AI API Manager.`);
  const service = data as CentralSeoService;
  if (service.status !== "active") {
    throw new Error(`${service.name} is inactive in AI API Manager.`);
  }
  if (service.approval_status !== "approved") {
    throw new Error(`${service.name} is pending owner approval in AI API Manager.`);
  }

  const environmentCredential = readEnvironmentCredential(service.credential_env);
  if (environmentCredential) return { db, service, credential: environmentCredential };

  const { data: credentials, error: credentialError } = await db
    .from("api_keys")
    .select("secret_encrypted")
    .eq("service_id", service.id)
    .eq("status", "active")
    .eq("environment", "production")
    .limit(1);
  if (credentialError) throw new Error(credentialError.message);
  const stored = credentials?.[0]?.secret_encrypted;
  if (typeof stored !== "string" || !stored.trim()) {
    throw new Error(
      `BLOCKED / CREDENTIAL REQUIRED for ${service.name}. Configure it in AI API Manager.`,
    );
  }
  return { db, service, credential: decryptAiCredential(stored) };
}

export async function recordCentralSeoUsage(
  db: ReturnType<typeof serverClient>,
  serviceId: string,
  capability: string,
  responseStatus: number,
  startedAt: number,
) {
  const durationMs = Date.now() - startedAt;
  const { error } = await db.from("usage_events").insert({
    service_id: serviceId,
    requests: 1,
    cost_usd: 0,
    success: responseStatus >= 200 && responseStatus < 400,
    latency_ms: durationMs,
    occurred_at: new Date().toISOString(),
    source: `seo:${capability}`,
    product: "seo-manager",
    status_code: responseStatus,
  });
  if (error) throw new Error(`Usage metering failed: ${error.message}`);
  const { error: auditError } = await db.from("audit_logs").insert({
    action: "SEO_PROVIDER_REQUEST",
    entity_type: "api_services",
    entity_id: serviceId,
    severity: responseStatus >= 400 ? "warning" : "info",
    metadata: { capability, response_status: responseStatus, duration_ms: durationMs },
  });
  if (auditError) throw new Error(`SEO provider audit logging failed: ${auditError.message}`);
}
