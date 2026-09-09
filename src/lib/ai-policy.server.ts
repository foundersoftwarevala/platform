import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The gate every AI call passes before a provider is contacted.
 *
 * AI API Manager already held the policy rows — product_apis, rate_limits,
 * emergency_controls — and the console could edit all of them, but no server
 * code read any of them on the request path. Disabling an API for a product
 * changed a switch in the browser and nothing else: the next request from that
 * product still reached the provider. This module is the missing half.
 *
 * It creates no table and no second policy store. Every decision comes from
 * rows the existing screens already write, and every refusal is recorded in
 * usage_events and audit_logs so it can be verified from the database rather
 * than from the browser.
 */

export type PolicyDecision =
  | { allowed: true; mapping: PolicyMapping | null }
  | { allowed: false; code: PolicyDenialCode; reason: string; httpStatus: number };

export type PolicyDenialCode =
  | "EMERGENCY_STOP"
  | "PRODUCT_API_DISABLED"
  | "SERVICE_NOT_MAPPED"
  | "PRODUCT_UNMAPPED"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMIT";

type PolicyMapping = {
  id: string;
  product: string;
  serviceId: string | null;
  enabled: boolean;
  quotaMonthly: number;
  usedThisMonth: number;
};

export type PolicyInput = {
  /** The Software Vala module the call came from, as written to usage_events.product. */
  product: string;
  serviceId: string;
  serviceName: string;
  modelRowId?: string | null | undefined;
};

/** Thrown when the gate refuses. Carries a safe code; never a provider payload. */
export class AiPolicyError extends Error {
  readonly code: PolicyDenialCode;
  readonly httpStatus: number;
  constructor(code: PolicyDenialCode, reason: string, httpStatus: number) {
    super(reason);
    this.name = "AiPolicyError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function serverClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !key) throw new Error("Supabase is not configured on the server.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readSetting(db: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await db.from("system_settings").select("value").eq("key", key).maybeSingle();
  const value = (data as { value?: unknown } | null)?.value;
  return typeof value === "string" ? value : null;
}

/**
 * Whether a product with no mapping at all may still call out.
 *
 * It may, unless an operator says otherwise. Today product_apis holds
 * marketplace catalogue names ("Retail POS") while the gateway records module
 * names ("chat", "legal", "seo"), so refusing every unmapped product would
 * silence all twelve AI features the moment a credential is added. The setting
 * lives in system_settings, the table the Settings screen already edits, and
 * flipping it to true turns "no mapping means denied" on for the whole
 * platform once the module mappings exist.
 */
async function requireMapping(db: SupabaseClient): Promise<boolean> {
  return (await readSetting(db, "ai_policy.require_mapping")) === "true";
}

/**
 * Every engaged kill switch that covers AI.
 *
 * emergency_controls ships with `global_ai_kill_switch`, scope `global`. The
 * console could engage it and the gateway never looked.
 */
async function emergencyStop(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from("emergency_controls")
    .select("key, label, engaged, scope")
    .eq("engaged", true);
  const rows = (data ?? []) as { key: string; label: string; scope: string }[];
  const hit = rows.find(
    (r) => r.scope === "global" || r.scope === "ai" || /ai/i.test(r.key) || /ai/i.test(r.label),
  );
  return hit ? hit.label || hit.key : null;
}

/** Requests already recorded for a service inside the configured window. */
async function requestsInWindow(
  db: SupabaseClient,
  serviceId: string,
  windowSeconds: number,
): Promise<number> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await db
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("service_id", serviceId)
    .gte("occurred_at", since);
  return count ?? 0;
}

/**
 * The decision itself. Order matters: the cheapest and most absolute checks
 * run first, so an engaged kill switch costs one query and never reaches the
 * quota arithmetic.
 */
export async function evaluateAiPolicy(input: PolicyInput): Promise<PolicyDecision> {
  const db = serverClient();

  const stopped = await emergencyStop(db);
  if (stopped) {
    return {
      allowed: false,
      code: "EMERGENCY_STOP",
      reason: `AI calls are stopped platform-wide by "${stopped}".`,
      httpStatus: 503,
    };
  }

  const { data: mappingRows } = await db
    .from("product_apis")
    .select("id, product, service_id, enabled, quota_monthly, used_this_month")
    .eq("product", input.product);

  const rows = (mappingRows ?? []) as {
    id: string;
    product: string;
    service_id: string | null;
    enabled: boolean;
    quota_monthly: number;
    used_this_month: number;
  }[];

  let mapping: PolicyMapping | null = null;

  if (rows.length === 0) {
    if (await requireMapping(db)) {
      return {
        allowed: false,
        code: "PRODUCT_UNMAPPED",
        reason: `No API mapping exists for product "${input.product}".`,
        httpStatus: 403,
      };
    }
  } else {
    const row = rows.find((r) => r.service_id === input.serviceId);

    // The product restricts which services it may use, and this is not one of
    // them. This is the product override: a service enabled globally is still
    // refused here.
    if (!row) {
      return {
        allowed: false,
        code: "SERVICE_NOT_MAPPED",
        reason: `Product "${input.product}" is not mapped to ${input.serviceName}.`,
        httpStatus: 403,
      };
    }

    if (!row.enabled) {
      return {
        allowed: false,
        code: "PRODUCT_API_DISABLED",
        reason: `${input.serviceName} is disabled for product "${input.product}".`,
        httpStatus: 403,
      };
    }

    if (row.quota_monthly > 0 && row.used_this_month >= row.quota_monthly) {
      return {
        allowed: false,
        code: "QUOTA_EXCEEDED",
        reason: `Product "${input.product}" has used its monthly quota of ${row.quota_monthly} requests.`,
        httpStatus: 429,
      };
    }

    mapping = {
      id: row.id,
      product: row.product,
      serviceId: row.service_id,
      enabled: row.enabled,
      quotaMonthly: row.quota_monthly,
      usedThisMonth: row.used_this_month,
    };
  }

  const { data: limitRows } = await db
    .from("rate_limits")
    .select("scope, window_seconds, max_requests, burst, action_on_exceed, enabled")
    .eq("service_id", input.serviceId)
    .eq("enabled", true);

  for (const limit of (limitRows ?? []) as {
    scope: string;
    window_seconds: number;
    max_requests: number;
    burst: number;
    action_on_exceed: string;
  }[]) {
    const ceiling = Number(limit.max_requests) + Number(limit.burst ?? 0);
    const used = await requestsInWindow(db, input.serviceId, Number(limit.window_seconds) || 60);
    if (used >= ceiling) {
      return {
        allowed: false,
        code: "RATE_LIMIT",
        reason:
          `${input.serviceName} passed its ${limit.scope} rate limit ` +
          `(${used}/${ceiling} in ${limit.window_seconds}s, configured action: ${limit.action_on_exceed}).`,
        httpStatus: 429,
      };
    }
  }

  return { allowed: true, mapping };
}

/**
 * A refusal has to be visible in the database, not only in the caller's error.
 *
 * usage_events carries source "ai-policy" so a denial can never be mistaken for
 * a provider call, and audit_logs carries the decision for the operator who
 * configured the policy.
 */
export async function recordPolicyDenial(
  input: PolicyInput,
  decision: Extract<PolicyDecision, { allowed: false }>,
): Promise<void> {
  try {
    const db = serverClient();
    await db.from("usage_events").insert({
      service_id: input.serviceId,
      model_id: input.modelRowId ?? null,
      product: input.product,
      requests: 1,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: 0,
      status_code: decision.httpStatus,
      success: false,
      source: "ai-policy",
    });
    await db.from("audit_logs").insert({
      actor: "ai-gateway",
      action: `ai.request.denied.${decision.code.toLowerCase()}`,
      entity_type: "product_apis",
      entity_id: null,
      severity: decision.code === "EMERGENCY_STOP" ? "critical" : "warning",
      metadata: {
        product: input.product,
        service: input.serviceName,
        service_id: input.serviceId,
        code: decision.code,
        reason: decision.reason,
      } as never,
    });
  } catch {
    // Recording a refusal must never turn into a second failure.
  }
}

/**
 * Count a served request against the product's monthly quota.
 *
 * used_this_month already existed on product_apis and already drove the quota
 * display; nothing incremented it, so the number shown was whatever was seeded.
 */
export async function consumeProductQuota(mapping: PolicyMapping | null): Promise<void> {
  if (!mapping) return;
  try {
    const db = serverClient();
    await db
      .from("product_apis")
      .update({ used_this_month: mapping.usedThisMonth + 1 })
      .eq("id", mapping.id);
  } catch {
    // Metering must never be the reason a served request reports failure.
  }
}
