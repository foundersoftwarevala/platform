import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { ALL_PERMISSIONS } from "@/lib/marketplace/permission-guard";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * Security & Access, over the authentication that actually exists.
 *
 * The roles half of this screen was connected earlier and is unchanged - this
 * adds the other four tabs from the real auth backend rather than from tables
 * that describe one.
 *
 * The finding that shapes the whole file: GoTrue has no admin endpoint for
 * listing sessions. /auth/v1/admin/sessions answers 404, so the number of
 * active sessions cannot be known from here at all. Section 1 says a source
 * that is unavailable renders as a dash, and section 26 says to show NOT
 * CONNECTED rather than pretend, so the sessions figure is null with the reason
 * attached, and what can honestly be reported instead - who signed in, and when
 * - is reported as exactly that.
 *
 * Two more measurements worth having and neither flattering: of 84 accounts,
 * none has a second factor enrolled, and security_events and
 * server_login_history both exist and have never been written to. Those are
 * zeroes, not dashes, because the source answered.
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

async function count(path: string): Promise<number | null> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!response.ok) return null;
    return Number((response.headers.get("content-range") ?? "").split("/")[1]) || 0;
  } catch {
    return null;
  }
}

type AuthUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  factors?: unknown[] | null;
  is_anonymous?: boolean;
};

/** The accounts themselves, from GoTrue. The authoritative source for identity. */
async function authUsers(): Promise<{ users: AuthUser[]; ok: boolean }> {
  const collected: AuthUser[] = [];
  try {
    for (let page = 1; page <= 5; page += 1) {
      const response = await fetch(`${url()}/auth/v1/admin/users?per_page=200&page=${page}`, {
        headers: admin(),
      });
      if (!response.ok) return { users: collected, ok: false };
      const body = (await response.json()) as { users?: AuthUser[] };
      const batch = body.users ?? [];
      collected.push(...batch);
      if (batch.length < 200) break;
    }
    return { users: collected, ok: true };
  } catch {
    return { users: collected, ok: false };
  }
}

/**
 * Whether the auth backend can list sessions at all.
 *
 * Asked rather than assumed, so if GoTrue ever gains the endpoint this screen
 * starts reporting real sessions without anyone editing it.
 */
async function sessionsSupported(): Promise<{ supported: boolean; status: number | null }> {
  try {
    const response = await fetch(`${url()}/auth/v1/admin/sessions`, { headers: admin() });
    return { supported: response.ok, status: response.status };
  } catch {
    return { supported: false, status: null };
  }
}

const days = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.floor((Date.now() - at) / 86400000) : null;
};

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
        p_action: action, p_entity_type: "security", p_entity_id: null,
        p_before: null, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[security] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/security")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        // Section 11: 401 when unauthenticated is the outer gate's job; this is
        // the 403 when authenticated and not permitted.
        if (!may("audit")) {
          await recordDenial(request, {
            action: "security_view", permission: "marketplace.audit.view",
            roles: caller.roles, entityType: "security", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.audit.view is required." },
            { status: 403 },
          );
        }

        /* --------------------------------------------- audit tab (paged) */
        const page = Math.max(1, Number(params.get("page") ?? 1));
        const size = Math.min(100, Math.max(10, Number(params.get("size") ?? 25)));
        const q = (params.get("q") ?? "").trim();
        const entity = params.get("entity") ?? "all";
        const result = params.get("result") ?? "all";

        let filter = "";
        if (entity !== "all") filter += `&entity_type=eq.${encodeURIComponent(entity)}`;
        if (result === "denied") filter += "&action=like.*denied*";
        if (q) filter += `&or=(action.ilike.*${encodeURIComponent(q)}*,actor.ilike.*${encodeURIComponent(q)}*,reason.ilike.*${encodeURIComponent(q)}*)`;

        const [auditRows, auditTotal] = await Promise.all([
          rows<Record<string, unknown>>(
            `marketplace_audit_logs?select=id,action,actor,actor_role,entity_type,entity_id,reason,created_at,ip_address` +
              `${filter}&order=created_at.desc&offset=${(page - 1) * size}&limit=${size}`,
          ),
          count(`marketplace_audit_logs?select=id${filter}`),
        ]);

        if (params.get("panel") === "audit") {
          return Response.json({
            ok: true, page, size, total: auditTotal, rows: auditRows,
            entities: [...new Set(auditRows.map((r) => String(r.entity_type)))].sort(),
          });
        }

        /* --------------------------------------------------------- rest */
        const [
          { users, ok: authOk }, sessions, roleRows, alerts,
          securityEvents, loginHistory, blockedIps, deniedCount,
        ] = await Promise.all([
          authUsers(),
          sessionsSupported(),
          rows<{ role: string; user_id: string }>("user_roles?select=role,user_id"),
          rows<Record<string, unknown>>(
            "security_alerts?select=*&limit=25",
          ),
          count("security_events?select=id"),
          count("server_login_history?select=id"),
          count("payment_blacklist?select=id"),
          count("marketplace_audit_logs?select=id&action=like.*denied*"),
        ]);

        const byRole: Record<string, number> = {};
        for (const r of roleRows) byRole[r.role] = (byRole[r.role] ?? 0) + 1;

        const withFactor = users.filter((u) => Array.isArray(u.factors) && u.factors.length > 0);
        const banned = users.filter((u) => u.banned_until);
        const signedInEver = users.filter((u) => u.last_sign_in_at);
        const recent = users.filter((u) => {
          const d = days(u.last_sign_in_at);
          return d !== null && d <= 7;
        });

        return Response.json({
          ok: true,
          metrics: {
            roles: Object.keys(byRole).length,
            // Section 1 and 26: the source does not exist, so this is a dash.
            sessions: null,
            two_factor: authOk ? withFactor.length : null,
            blocked: authOk ? banned.length + (blockedIps ?? 0) : null,
          },
          metric_sources: {
            roles: "user_roles — distinct role values actually held by an account.",
            sessions:
              `GoTrue has no admin endpoint for listing sessions; /auth/v1/admin/sessions answers ${sessions.status ?? "nothing"}. There is no way to count active sessions from here, so this is a dash rather than a number.`,
            two_factor: "The auth backend's own MFA factors, read per account.",
            blocked: "Accounts with banned_until set, plus payment_blacklist rows.",
          },
          roles: {
            distinct: Object.keys(byRole).length,
            assignments: roleRows.length,
            breakdown: Object.entries(byRole).sort((a, b) => b[1] - a[1]),
            permissions_available: ALL_PERMISSIONS.length,
            note: "The role and permission matrix is the Roles tab, and it is the same matrix the server consults on every request.",
          },
          audit: {
            page, size, total: auditTotal, rows: auditRows,
            denied_attempts: deniedCount,
            append_only:
              "No signed-in role can update or delete these rows — verified by attempting both with the anonymous key and being refused.",
          },
          sessions: {
            supported: sessions.supported,
            endpoint_status: sessions.status,
            state: sessions.supported ? "CONNECTED" : "NOT CONNECTED",
            reason: sessions.supported
              ? null
              : "The authentication backend does not expose a session list to an administrator. Revoking a single session from here is therefore not possible either, and no button pretends otherwise.",
            // What can honestly be said about who has been signing in.
            accounts: authOk ? users.length : null,
            signed_in_ever: authOk ? signedInEver.length : null,
            signed_in_last_7_days: authOk ? recent.length : null,
            recent: recent
              .sort((a, b) => Date.parse(b.last_sign_in_at ?? "0") - Date.parse(a.last_sign_in_at ?? "0"))
              .slice(0, 25)
              .map((u) => ({
                id: u.id,
                email: u.email ?? null,
                last_sign_in_at: u.last_sign_in_at ?? null,
                days_ago: days(u.last_sign_in_at),
                confirmed: Boolean(u.email_confirmed_at),
                banned: Boolean(u.banned_until),
              })),
            login_history_rows: loginHistory,
            login_history_note:
              loginHistory === 0
                ? "server_login_history exists and has never been written to. Sign-in times come from the auth backend instead, which is the authoritative source for them anyway."
                : null,
          },
          two_factor: {
            enrolled: authOk ? withFactor.length : null,
            accounts: authOk ? users.length : null,
            coverage: authOk && users.length ? Math.round((withFactor.length / users.length) * 1000) / 10 : null,
            state: authOk ? (withFactor.length === 0 ? "NONE ENROLLED" : "PARTIAL") : "NOT CONNECTED",
            note:
              authOk && withFactor.length === 0
                ? "Not one of these accounts has a second factor enrolled. The auth backend supports it; nobody has turned it on, including every account that can change permissions or configuration."
                : null,
            enforcement:
              "There is no 2FA policy engine here. Enrolment is per account in the auth backend, and this screen reports it rather than claiming to enforce a policy that does not exist.",
          },
          access: {
            ip_rules: 0,
            ip_rules_state: "NOT CONNECTED",
            ip_rules_reason:
              "No IP allowlist or blocklist table exists on this database, and there is no path to create one from here — the management token answers 401, so there is no DDL. payment_blacklist exists and belongs to Finance; it holds payment identifiers, not network rules.",
            blocked_payment_identifiers: blockedIps,
            security_events: securityEvents,
            security_events_note:
              securityEvents === 0
                ? "security_events exists and has never been written to. The denied attempts this console records go to marketplace_audit_logs instead, and that count is shown above."
                : null,
            alerts: alerts,
          },
          permissions: {
            view: true,
            export: may("export"),
            configure: may("configure_permissions"),
          },
          caller: { roles: caller.roles },
        });
      },

      /** Section 20: an audited export of what the caller may already read. */
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { action?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({ roles: caller.roles, action: "export", permissions: matrix });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "security_export", permission: "marketplace.export",
            roles: caller.roles, entityType: "security", recordId: null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: decision.reason },
            { status: 403 },
          );
        }

        if (body.action !== "export_audit") {
          return Response.json(
            { ok: false, reason: "unsupported_action", message: "Only export_audit runs from here." },
            { status: 400 },
          );
        }

        const list = await rows<Record<string, unknown>>(
          "marketplace_audit_logs?select=created_at,action,actor,actor_role,entity_type,entity_id,reason&order=created_at.desc&limit=5000",
        );
        const cell = (v: unknown) => {
          const t = v === null || v === undefined ? "" : String(v);
          return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        };
        const lines = ["created_at,action,actor,actor_role,entity_type,entity_id,reason"];
        for (const r of list) {
          lines.push([
            r.created_at, r.action, r.actor, r.actor_role, r.entity_type, r.entity_id, r.reason,
          ].map(cell).join(","));
        }
        await audit(request, "Security audit exported", { rows: list.length },
          `${list.length} audit rows were exported from the Security screen.`);
        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="security-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        });
      },
    },
  },
});
