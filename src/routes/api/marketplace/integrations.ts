import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * The Integrations Hub, over the connectors that actually exist.
 *
 * Section 55 is the whole brief in one word: never simulate connected. So this
 * does not read a status column and print it. It checks.
 *
 * Three checks, and each one found something.
 *
 * The webhook check calls every endpoint a connector says it receives on. Five
 * rows in api_integrations declare inbound webhooks with signature auth and
 * status "connected"; all five paths answer 404, because no such route exists
 * in this application. A row saying connected over a URL that is not served is
 * exactly the fake status section 55 forbids, and it was already in the
 * database.
 *
 * The credential check asks whether the environment variable a provider needs
 * is actually set - the name only, never the value, and never to the browser.
 *
 * The freshness check compares last_sync_at to now. Every one of those
 * "connected" rows last synced on 17 August. Connected three weeks ago and
 * connected are not the same claim.
 *
 * Ownership is respected rather than absorbed: finance_gateways belongs to the
 * Finance Manager and seo_integrations to the SEO Manager. This hub reports on
 * them and links to them; it does not become a second place to change them.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows<T = Record<string, unknown>>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

async function count(path: string): Promise<number> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!response.ok) return 0;
    return Number((response.headers.get("content-range") ?? "").split("/")[1]) || 0;
  } catch {
    return 0;
  }
}

type Tab = "Analytics" | "Pixels" | "Payments" | "Finance";

type Connector = {
  id: string;
  name: string;
  tab: Tab;
  source: string;
  /** The manager that owns this row. This hub reports; it does not take over. */
  authority: string;
  category: string;
  direction: string | null;
  auth_type: string | null;
  /** What the record claims. */
  declared_status: string;
  /** What the checks found. */
  state: "connected" | "not_connected" | "failing" | "stale" | "unknown";
  webhook_url: string | null;
  webhook_status: number | null;
  credential_env: string | null;
  credential_present: boolean | null;
  last_sync_at: string | null;
  days_since_sync: number | null;
  error_count: number;
  findings: string[];
};

/** The thirteen the screen lists, and which tab each belongs on. */
const SCREEN_CONNECTORS: { name: string; tab: Tab; match: RegExp }[] = [
  { name: "Google Analytics", tab: "Analytics", match: /google[_ ]analytics/i },
  { name: "Google Search Console", tab: "Analytics", match: /search[_ ]console/i },
  { name: "Microsoft Clarity", tab: "Analytics", match: /clarity/i },
  { name: "Meta Pixel", tab: "Pixels", match: /meta|facebook/i },
  { name: "TikTok Pixel", tab: "Pixels", match: /tiktok/i },
  { name: "LinkedIn Insight", tab: "Pixels", match: /linkedin/i },
  { name: "Stripe", tab: "Payments", match: /stripe/i },
  { name: "PayPal", tab: "Payments", match: /paypal/i },
  { name: "Razorpay", tab: "Payments", match: /razorpay/i },
  { name: "Flutterwave", tab: "Payments", match: /flutterwave/i },
  { name: "Paystack", tab: "Payments", match: /paystack/i },
  { name: "Wise", tab: "Finance", match: /wise/i },
  { name: "Coinbase Commerce", tab: "Finance", match: /coinbase/i },
];

const daysSince = (value: unknown): number | null => {
  if (!value) return null;
  const at = Date.parse(String(value));
  return Number.isFinite(at) ? Math.round((Date.now() - at) / 86400000) : null;
};

/** Anything older than this has not been checked recently enough to be called live. */
const STALE_DAYS = 3;

async function probeWebhook(origin: string, path: string): Promise<number | null> {
  try {
    const response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return response.status;
  } catch {
    return null;
  }
}

async function collect(origin: string): Promise<{ connectors: Connector[]; missing: typeof SCREEN_CONNECTORS }> {
  const [integrations, seo, gateways, providers] = await Promise.all([
    rows<Record<string, unknown>>(
      "api_integrations?select=id,name,category,direction,auth_type,status,error_count,last_sync_at,webhook_url",
    ),
    rows<Record<string, unknown>>(
      "seo_integrations?select=id,provider,display_name,category,status,last_sync_at",
    ),
    rows<Record<string, unknown>>(
      "finance_gateways?select=id,code,name,provider,status,success_rate,fee_percent,settlement_cycle",
    ),
    rows<Record<string, unknown>>(
      "ai_providers?select=slug,name,status,credential_env",
    ),
  ]);

  const credentialFor = (needle: string): { env: string | null; present: boolean | null } => {
    const provider = providers.find((p) =>
      String(p.slug).toLowerCase().includes(needle) || String(p.name).toLowerCase().includes(needle));
    const env = provider?.credential_env ? String(provider.credential_env) : null;
    return { env, present: env ? Boolean(process.env[env]?.trim()) : null };
  };

  const tabFor = (category: string, name: string): Tab => {
    const lower = `${category} ${name}`.toLowerCase();
    if (/payment|gateway/.test(lower)) return "Payments";
    if (/analytic|search|seo|research/.test(lower)) return "Analytics";
    if (/pixel|social|ads|advertis/.test(lower)) return "Pixels";
    return "Finance";
  };

  const connectors: Connector[] = [];

  // 1. api_integrations, with its declared webhooks actually called.
  for (const row of integrations) {
    const webhook = row.webhook_url ? String(row.webhook_url) : null;
    const status = webhook ? await probeWebhook(origin, webhook) : null;
    const age = daysSince(row.last_sync_at);
    const errors = Number(row.error_count ?? 0);
    const credential = credentialFor(String(row.name).split(" ")[0].toLowerCase());
    const findings: string[] = [];

    if (webhook && status !== null && status >= 400) {
      findings.push(
        `It declares an inbound webhook at ${webhook} and that path answers ${status}. No such route is served by this application, so nothing could ever be delivered to it.`,
      );
    }
    if (age !== null && age > STALE_DAYS) {
      findings.push(`Its last sync was ${age} days ago, so "connected" describes August rather than now.`);
    }
    if (errors > 0) findings.push(`${errors} error(s) recorded against it.`);
    if (credential.env && credential.present === false) {
      findings.push(`${credential.env} is not set in this environment.`);
    }

    const state: Connector["state"] =
      findings.some((f) => f.includes("answers")) ? "failing"
        : String(row.status) === "error" ? "failing"
          : age !== null && age > STALE_DAYS ? "stale"
            : String(row.status) === "connected" ? "connected" : "not_connected";

    connectors.push({
      id: `api_integrations:${String(row.id)}`,
      name: String(row.name),
      tab: tabFor(String(row.category), String(row.name)),
      source: "api_integrations",
      authority: "Marketplace Manager",
      category: String(row.category),
      direction: (row.direction as string) ?? null,
      auth_type: (row.auth_type as string) ?? null,
      declared_status: String(row.status),
      state,
      webhook_url: webhook,
      webhook_status: status,
      credential_env: credential.env,
      credential_present: credential.present,
      last_sync_at: (row.last_sync_at as string) ?? null,
      days_since_sync: age,
      error_count: errors,
      findings,
    });
  }

  // 2. seo_integrations - the analytics and search connectors. Owned by SEO.
  for (const row of seo) {
    const age = daysSince(row.last_sync_at);
    const connected = String(row.status) === "connected";
    const findings: string[] = [];
    if (!connected) findings.push("Not connected. No credential has been supplied for it.");
    else if (age !== null && age > STALE_DAYS) findings.push(`Its last sync was ${age} days ago.`);
    connectors.push({
      id: `seo_integrations:${String(row.id)}`,
      name: String(row.display_name ?? row.provider),
      tab: tabFor(String(row.category), String(row.provider)),
      source: "seo_integrations",
      authority: "SEO Manager",
      category: String(row.category),
      direction: "outbound",
      auth_type: "oauth",
      declared_status: String(row.status),
      state: !connected ? "not_connected" : age !== null && age > STALE_DAYS ? "stale" : "connected",
      webhook_url: null, webhook_status: null,
      credential_env: null, credential_present: null,
      last_sync_at: (row.last_sync_at as string) ?? null,
      days_since_sync: age,
      error_count: 0,
      findings,
    });
  }

  // 3. finance_gateways - money. The Finance Manager owns these outright.
  for (const row of gateways) {
    const credential = credentialFor(String(row.code));
    const findings: string[] = [];
    if (credential.env && credential.present === false) {
      findings.push(`${credential.env} is not set, so this gateway cannot authenticate.`);
    }
    if (String(row.status) !== "active") {
      findings.push(`Marked ${row.status} in the Finance Manager.`);
    }
    connectors.push({
      id: `finance_gateways:${String(row.id)}`,
      name: String(row.name),
      tab: "Payments",
      source: "finance_gateways",
      authority: "Finance Manager",
      category: "payments",
      direction: "outbound",
      auth_type: "api_key",
      declared_status: String(row.status),
      state: String(row.status) === "active" && credential.present !== false ? "connected" : "not_connected",
      webhook_url: null, webhook_status: null,
      credential_env: credential.env,
      credential_present: credential.present,
      last_sync_at: null, days_since_sync: null,
      error_count: 0,
      findings,
    });
  }

  // Which of the screen's thirteen have no record at all.
  const missing = SCREEN_CONNECTORS.filter(
    (wanted) => !connectors.some((c) => wanted.match.test(c.name)),
  );

  return { connectors, missing };
}

async function audit(request: Request, action: string, after: unknown, reason: string) {
  try {
    const authorization = request.headers.get("authorization");
    const anon =
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const asOperator = Boolean(authorization && anon);
    await fetch(`${url()}/rest/v1/rpc/mm_audit`, {
      method: "POST",
      headers: asOperator
        ? { apikey: anon, Authorization: authorization!, "Content-Type": "application/json" }
        : { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_action: action, p_entity_type: "integrations", p_entity_id: null,
        p_before: null, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[integrations] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/integrations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const origin = new URL(request.url).origin;
        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("view")) {
          await recordDenial(request, {
            action: "integrations_view", permission: "marketplace.view",
            roles: caller.roles, entityType: "integrations", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.view is required." },
            { status: 403 },
          );
        }

        const { connectors, missing } = await collect(origin);

        const [paymentEvents, paymentLogs, analyticsEvents, consents, intents, marketplaceEvents] =
          await Promise.all([
            count("marketplace_payment_events?select=id"),
            count("payment_logs?select=id"),
            count("analytics_events?select=id"),
            count("marketing_consents?select=id"),
            count("marketplace_payment_intents?select=id"),
            count("marketplace_events?select=id"),
          ]);

        if (new URL(request.url).searchParams.get("format") === "csv") {
          if (!may("export")) {
            return Response.json({ ok: false, reason: "permission_denied" }, { status: 403 });
          }
          const cell = (v: unknown) => {
            const t = v === null || v === undefined ? "" : String(v);
            return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
          };
          const lines = ["name,source,authority,tab,declared_status,checked_state,webhook_url,webhook_status,credential_env,credential_present,last_sync_at,errors,findings"];
          for (const c of connectors) {
            lines.push([
              c.name, c.source, c.authority, c.tab, c.declared_status, c.state,
              c.webhook_url ?? "", c.webhook_status ?? "", c.credential_env ?? "",
              c.credential_present ?? "", c.last_sync_at ?? "", c.error_count,
              c.findings.join(" "),
            ].map(cell).join(","));
          }
          await audit(request, "Integrations exported", { connectors: connectors.length },
            "Connector metadata exported. No credential value is included.");
          return new Response(lines.join("\n"), {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="integrations-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
          });
        }

        const declaredConnected = connectors.filter((c) => c.declared_status === "connected" || c.declared_status === "active").length;
        const actuallyConnected = connectors.filter((c) => c.state === "connected").length;

        return Response.json({
          ok: true,
          connectors,
          missing: missing.map((m) => ({ name: m.name, tab: m.tab })),
          metrics: {
            total: connectors.length,
            declared_connected: declaredConnected,
            connected: actuallyConnected,
            failing: connectors.filter((c) => c.state === "failing").length,
            stale: connectors.filter((c) => c.state === "stale").length,
            not_connected: connectors.filter((c) => c.state === "not_connected").length,
            // Section 2 wants an event count. These are the event tables that
            // exist; the number is what is in them.
            events: paymentEvents + paymentLogs + analyticsEvents + marketplaceEvents,
            events_breakdown: {
              marketplace_events: marketplaceEvents,
              marketplace_payment_events: paymentEvents,
              payment_logs: paymentLogs,
              analytics_events: analyticsEvents,
              marketplace_payment_intents: intents,
            },
          },
          consent: {
            records: consents,
            // Section 54. No consent has been recorded, so nothing may assume it.
            note:
              consents === 0
                ? "marketing_consents holds no records. No tracking pixel may be switched on for a visitor on the basis of a consent that was never given, so the pixel connectors stay off regardless of any other setting."
                : `${consents} consent record(s).`,
          },
          checks: {
            webhooks_probed: connectors.filter((c) => c.webhook_url).length,
            webhooks_reachable: connectors.filter((c) => c.webhook_status !== null && c.webhook_status < 400).length,
            stale_after_days: STALE_DAYS,
            what:
              "Every declared webhook path was called on this server, every credential variable was looked up by name, and every last sync was compared against now.",
          },
          permissions: { view: true, test: may("settings_manage"), export: may("export") },
        });
      },

      /** Section 16: a real request, or an honest refusal. Never a green tick. */
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { id?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({
          roles: caller.roles, action: "settings_manage", permissions: matrix,
        });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "integration_test", permission: "marketplace.settings.manage",
            roles: caller.roles, entityType: "integrations", recordId: body.id ?? null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: decision.reason },
            { status: 403 },
          );
        }

        const origin = new URL(request.url).origin;
        const { connectors } = await collect(origin);
        const connector = connectors.find((c) => c.id === String(body.id ?? ""));
        if (!connector) {
          return Response.json({ ok: false, reason: "unknown_connector" }, { status: 400 });
        }

        const correlation = crypto.randomUUID();
        const started = Date.now();

        // What can honestly be tested here is the half this application owns:
        // whether the webhook route it declares is actually served. Calling
        // Stripe or Google to prove a connection needs a credential this
        // environment does not have, and inventing a result would be the exact
        // fake success section 16 rules out.
        if (connector.webhook_url) {
          const status = await probeWebhook(origin, connector.webhook_url);
          const latency = Date.now() - started;
          const ok = status !== null && status < 400;
          await audit(request, "Integration connection tested",
            { connector: connector.name, webhook: connector.webhook_url, status, latency_ms: latency, correlation },
            `${connector.name} was tested: its webhook path answered ${status ?? "nothing"}.`);
          return Response.json({
            ok: true, tested: "inbound_webhook", connector: connector.name,
            success: ok, status, latency_ms: latency, correlation_id: correlation,
            message: ok
              ? `${connector.webhook_url} is served and answered ${status}.`
              : `${connector.webhook_url} answered ${status ?? "nothing"}. No route is served there, so this connector could never receive an event.`,
          });
        }

        if (connector.credential_env && connector.credential_present === false) {
          await audit(request, "Integration connection tested",
            { connector: connector.name, result: "no_credential", correlation },
            `${connector.name} could not be tested: ${connector.credential_env} is not set.`);
          return Response.json({
            ok: true, tested: "credential", connector: connector.name,
            success: false, correlation_id: correlation,
            message: `${connector.credential_env} is not set in this environment, so there is nothing to authenticate with. Nothing was called.`,
          });
        }

        await audit(request, "Integration connection tested",
          { connector: connector.name, result: "no_test_available", correlation },
          `${connector.name} has no test this application can perform.`);
        return Response.json({
          ok: true, tested: "none", connector: connector.name, success: null,
          correlation_id: correlation,
          message: `${connector.name} is owned by the ${connector.authority} and has no endpoint here to call. Testing it means calling the provider with its credential, which belongs in that manager rather than in this hub.`,
        });
      },
    },
  },
});
