/**
 * DEMO OPERATIONS — DERIVATION LAYER
 * ==================================
 * Pure functions that turn real backend rows into the operational signals the
 * Operations Center renders. Nothing here invents values: every signal is
 * either derived from a stored column or explicitly reported as `unmonitored`
 * when the backend has no source for it yet.
 */

import type { Database } from "@/integrations/supabase/types";

export type DemoRow = Database["public"]["Tables"]["demos"]["Row"];
export type ValidationLogRow = Database["public"]["Tables"]["demo_validation_logs"]["Row"];
export type AlertRow = Database["public"]["Tables"]["demo_alerts"]["Row"];
export type AnalyticsRow = Database["public"]["Tables"]["demo_analytics"]["Row"];
export type EscalationRow = Database["public"]["Tables"]["demo_escalations"]["Row"];
export type CredentialRow = Database["public"]["Tables"]["demo_login_credentials"]["Row"];
export type DeploymentRow = Database["public"]["Tables"]["demo_deployments"]["Row"];

/** Live health state of a demo. */
export type HealthState = "live" | "slow" | "error" | "offline" | "maintenance";

export const HEALTH_META: Record<
  HealthState,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  live: {
    label: "Live",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  slow: {
    label: "Slow",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    dot: "bg-amber-400",
  },
  error: {
    label: "Error",
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/40",
    dot: "bg-red-400",
  },
  offline: {
    label: "Offline",
    text: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/40",
    dot: "bg-slate-400",
  },
  maintenance: {
    label: "Maintenance",
    text: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/40",
    dot: "bg-sky-400",
  },
};

/** Slow threshold in ms — anything above this on a reachable demo is degraded. */
export const SLOW_THRESHOLD_MS = 2500;

export const healthStateOf = (demo: DemoRow): HealthState => {
  if (demo.status === "maintenance") return "maintenance";
  if (demo.status === "down") return "offline";
  const http = demo.http_status ?? null;
  if (http !== null && http >= 400) return "error";
  if (demo.status === "inactive") return "offline";
  if ((demo.response_time_ms ?? 0) > SLOW_THRESHOLD_MS) return "slow";
  return "live";
};

/** Tri-state used everywhere a check may have no backend source yet. */
export type CheckState = "pass" | "fail" | "warn" | "unmonitored";

export interface OpsCheck {
  id: string;
  label: string;
  state: CheckState;
  /** What the value is, or why it is unmonitored. */
  detail: string;
  /** Which real column / table the value came from. */
  source: string;
}

export const CHECK_META: Record<CheckState, { label: string; text: string; bg: string; border: string }> = {
  pass: { label: "Pass", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40" },
  warn: { label: "Warning", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40" },
  fail: { label: "Fail", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/40" },
  unmonitored: {
    label: "Not monitored",
    text: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/40",
  },
};

export const safeUrl = (value: string | null | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
};

const SHARED_HOSTS = [
  "lovable.app",
  "lovableproject.com",
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "onrender.com",
  "github.io",
];

export const isSharedHost = (host: string) => SHARED_HOSTS.some((h) => host.endsWith(h));

/* ------------------------------------------------------------------ */
/* Branding                                                            */
/* ------------------------------------------------------------------ */

export const brandingChecks = (demo: DemoRow): OpsCheck[] => [
  {
    id: "company-name",
    label: "Auto Company Name",
    state: demo.title?.trim() ? "pass" : "fail",
    detail: demo.title?.trim() ? demo.title : "No demo title stored — branding cannot resolve a company name.",
    source: "demos.title",
  },
  {
    id: "footer",
    label: "Auto Footer / Banner",
    state: demo.demo_banner_text?.trim() ? "pass" : "fail",
    detail: demo.demo_banner_text?.trim() || "No banner/footer text stored for this demo.",
    source: "demos.demo_banner_text",
  },
  {
    id: "copyright",
    label: "Auto Copyright",
    state: demo.demo_banner_text?.toLowerCase().includes("©") || demo.demo_banner_text?.toLowerCase().includes("copyright")
      ? "pass"
      : "warn",
    detail:
      demo.demo_banner_text?.toLowerCase().includes("©") || demo.demo_banner_text?.toLowerCase().includes("copyright")
        ? "Copyright line present in the banner text."
        : "Banner text carries no copyright line — footer copyright will fall back to the platform default.",
    source: "demos.demo_banner_text",
  },
  {
    id: "white-label-domain",
    label: "White-label URL",
    state: demo.masked_url?.trim() ? "pass" : "warn",
    detail: demo.masked_url?.trim() || "No masked URL — the raw hosting URL is exposed to viewers.",
    source: "demos.masked_url",
  },
  {
    id: "logo",
    label: "Auto Logo",
    state: "unmonitored",
    detail: "No logo asset column exists on demos yet — connect the branding asset store to validate logos.",
    source: "needs branding asset source",
  },
  {
    id: "favicon",
    label: "Auto Favicon",
    state: "unmonitored",
    detail: "Favicon fetch is not wired — needs a crawler that reads /favicon.ico per demo URL.",
    source: "needs crawler",
  },
  {
    id: "theme",
    label: "Auto Theme Color",
    state: "unmonitored",
    detail: "Theme colour is not stored per demo — needs a branding profile table.",
    source: "needs branding profile",
  },
];

/* ------------------------------------------------------------------ */
/* Domain / SSL / DNS / HTTPS                                          */
/* ------------------------------------------------------------------ */

export const domainChecks = (demo: DemoRow, deployment?: DeploymentRow | null): OpsCheck[] => {
  const url = safeUrl(demo.url);
  const host = url?.hostname ?? "";
  const https = url?.protocol === "https:";
  return [
    {
      id: "https",
      label: "Auto HTTPS Check",
      state: url ? (https ? "pass" : "fail") : "fail",
      detail: url
        ? https
          ? `Serving over HTTPS (${host})`
          : `Demo URL uses ${url.protocol} — traffic is unencrypted.`
        : `Stored URL is not parseable: ${demo.url}`,
      source: "demos.url",
    },
    {
      id: "domain-mapping",
      label: "Auto Domain Mapping",
      state: deployment?.approved_domain
        ? "pass"
        : host && !isSharedHost(host)
          ? "pass"
          : host
            ? "warn"
            : "fail",
      detail: deployment?.approved_domain
        ? `Approved domain: ${deployment.approved_domain}${deployment.is_domain_locked ? " (locked)" : ""}`
        : host
          ? isSharedHost(host)
            ? `Running on shared host ${host} — no custom domain mapped.`
            : `Custom domain in use: ${host}`
          : "No host resolved from the stored URL.",
      source: "demo_deployments.approved_domain / demos.url",
    },
    {
      id: "reachability",
      label: "Last HTTP response",
      state:
        demo.http_status === null
          ? "unmonitored"
          : demo.http_status >= 500
            ? "fail"
            : demo.http_status >= 400
              ? "warn"
              : "pass",
      detail:
        demo.http_status === null
          ? "No HTTP status recorded yet — run a health check."
          : `HTTP ${demo.http_status} at ${demo.last_health_check ? new Date(demo.last_health_check).toLocaleString() : "unknown time"}`,
      source: "demos.http_status",
    },
    {
      id: "ssl-expiry",
      label: "Auto SSL Check (certificate expiry)",
      state: "unmonitored",
      detail: "Certificate chain and expiry require a TLS probe — no certificate data is stored yet.",
      source: "needs TLS prober",
    },
    {
      id: "dns",
      label: "Auto DNS Check",
      state: "unmonitored",
      detail: "A / CNAME record verification requires a DNS resolver — no DNS results are stored yet.",
      source: "needs DNS resolver",
    },
  ];
};

/* ------------------------------------------------------------------ */
/* Failure detection                                                   */
/* ------------------------------------------------------------------ */

export type DetectionKind =
  | "404"
  | "500"
  | "blank"
  | "build"
  | "api"
  | "database"
  | "login";

export const DETECTION_LABELS: Record<DetectionKind, string> = {
  "404": "404 Not Found",
  "500": "500 Server Error",
  blank: "Blank screen",
  build: "Build failure",
  api: "API failure",
  database: "Database connection",
  login: "Login failure",
};

export interface DetectionHit {
  kind: DetectionKind;
  demoId: string;
  demoTitle: string;
  at: string;
  evidence: string;
}

const matchKinds = (httpStatus: number | null, message: string, validationType: string | null): DetectionKind[] => {
  const kinds: DetectionKind[] = [];
  const m = message.toLowerCase();
  const type = (validationType ?? "").toLowerCase();
  if (httpStatus === 404 || m.includes("404") || m.includes("not found")) kinds.push("404");
  if ((httpStatus !== null && httpStatus >= 500) || m.includes("500") || m.includes("internal server error"))
    kinds.push("500");
  if (m.includes("blank") || m.includes("empty response") || m.includes("no content") || m.includes("white screen"))
    kinds.push("blank");
  if (m.includes("build") || m.includes("compil") || m.includes("bundle")) kinds.push("build");
  if (m.includes("api") || m.includes("fetch failed") || m.includes("gateway") || m.includes("timeout") || m.includes("502") || m.includes("503"))
    kinds.push("api");
  if (m.includes("database") || m.includes("connection refused") || m.includes("postgres") || m.includes("sql") || m.includes("econnrefused"))
    kinds.push("database");
  if (type.includes("login") || m.includes("login") || m.includes("unauthorized") || m.includes("401") || m.includes("credential"))
    kinds.push("login");
  return kinds;
};

export const detectFailures = (demos: DemoRow[], logs: ValidationLogRow[]): DetectionHit[] => {
  const titleById = new Map(demos.map((d) => [d.id, d.title]));
  const hits: DetectionHit[] = [];

  for (const demo of demos) {
    const kinds = matchKinds(demo.http_status ?? null, "", null);
    for (const kind of kinds) {
      hits.push({
        kind,
        demoId: demo.id,
        demoTitle: demo.title,
        at: demo.last_health_check ?? demo.updated_at,
        evidence: `Stored HTTP status ${demo.http_status} on demos row`,
      });
    }
  }

  for (const log of logs) {
    const kinds = matchKinds(log.http_status ?? null, log.error_message ?? "", log.validation_type);
    const demoId = log.demo_id ?? "";
    for (const kind of kinds) {
      hits.push({
        kind,
        demoId,
        demoTitle: titleById.get(demoId) ?? log.demo_url ?? demoId,
        at: log.validated_at ?? log.created_at ?? new Date().toISOString(),
        evidence:
          log.error_message ??
          `${log.validation_type ?? "check"} returned HTTP ${log.http_status ?? "—"} (${log.status})`,
      });
    }
  }


  return hits.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
};

/* ------------------------------------------------------------------ */
/* Scores                                                              */
/* ------------------------------------------------------------------ */

/** Deterministic performance score from stored latency + uptime. */
export const performanceScore = (demo: DemoRow): number | null => {
  const rt = demo.response_time_ms;
  const uptime = demo.uptime_percentage;
  if (rt === null && uptime === null) return null;
  const latencyScore = rt === null ? null : Math.max(0, 100 - (rt / SLOW_THRESHOLD_MS) * 60);
  const uptimeScore = uptime === null ? null : uptime;
  const parts = [latencyScore, uptimeScore].filter((v): v is number => v !== null);
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
};

export const scoreTone = (score: number | null): CheckState =>
  score === null ? "unmonitored" : score >= 90 ? "pass" : score >= 70 ? "warn" : "fail";

/* ------------------------------------------------------------------ */
/* Security                                                            */
/* ------------------------------------------------------------------ */

const WEAK_PASSWORDS = ["admin", "admin123", "password", "password123", "123456", "demo", "demo123", "test", "test123", "12345678"];

export const securityChecks = (demo: DemoRow, credentials: CredentialRow[]): OpsCheck[] => {
  const url = safeUrl(demo.url);
  const weak = credentials.filter((c) => WEAK_PASSWORDS.includes((c.password ?? "").trim().toLowerCase()));
  return [
    {
      id: "ssl",
      label: "SSL / TLS",
      state: url ? (url.protocol === "https:" ? "pass" : "fail") : "fail",
      detail: url ? `Scheme: ${url.protocol.replace(":", "")}` : "URL not parseable",
      source: "demos.url",
    },
    {
      id: "default-password",
      label: "Default / weak password",
      state: credentials.length === 0 ? "unmonitored" : weak.length > 0 ? "fail" : "pass",
      detail:
        credentials.length === 0
          ? "No demo credentials stored for this demo."
          : weak.length > 0
            ? `${weak.length} credential(s) use a well-known default: ${weak.map((c) => c.role_type).join(", ")}`
            : `${credentials.length} credential(s) checked, none use a known default.`,
      source: "demo_login_credentials.password",
    },
    {
      id: "export-lock",
      label: "Destructive / export actions disabled",
      state: demo.disable_destructive && demo.disable_exports ? "pass" : "warn",
      detail: `Destructive actions ${demo.disable_destructive ? "blocked" : "allowed"}, exports ${
        demo.disable_exports ? "blocked" : "allowed"
      }.`,
      source: "demos.disable_destructive / disable_exports",
    },
    {
      id: "headers",
      label: "Security headers",
      state: "unmonitored",
      detail: "HSTS / CSP / X-Frame-Options require a response-header probe — none stored yet.",
      source: "needs header probe",
    },
    {
      id: "exposed-files",
      label: "Exposed files (.env, .git)",
      state: "unmonitored",
      detail: "Path probing for exposed files is not wired to this backend yet.",
      source: "needs path scanner",
    },
    {
      id: "debug-mode",
      label: "Debug mode",
      state: "unmonitored",
      detail: "Debug-mode fingerprinting requires page body inspection — not stored yet.",
      source: "needs crawler",
    },
  ];
};

/* ------------------------------------------------------------------ */
/* Root cause (deterministic rules over stored errors)                 */
/* ------------------------------------------------------------------ */

export interface RootCause {
  title: string;
  cause: string;
  fix: string;
  severity: "critical" | "high" | "medium";
}

export const rootCauseFor = (kind: DetectionKind): RootCause => {
  switch (kind) {
    case "404":
      return {
        title: "404 — route or deployment missing",
        cause:
          "The host answered but the requested path does not exist: the demo was redeployed to a new path, the SPA fallback is missing, or the stored demo URL is stale.",
        fix: "Verify the stored demo URL, then confirm the host serves an SPA fallback for unknown routes. Update the URL in the demo record if the deployment moved.",
        severity: "high",
      };
    case "500":
      return {
        title: "500 — server-side exception",
        cause:
          "The application process started but threw while rendering the response. Most often a missing environment variable, a failed migration, or an unhandled exception in the entry handler.",
        fix: "Pull the server logs for the failing deployment, check required environment variables, and re-run pending migrations before restarting.",
        severity: "critical",
      };
    case "blank":
      return {
        title: "Blank screen — client bundle failed",
        cause:
          "The server returned a 200 with an empty root element, which means the JS bundle 404'd, threw on boot, or the build output path is wrong.",
        fix: "Rebuild the demo and confirm the asset base path. Check the browser console of the live URL for a bundle load error.",
        severity: "high",
      };
    case "build":
      return {
        title: "Build failure",
        cause: "The last deployment pipeline failed, so the demo is serving a stale or missing artefact.",
        fix: "Re-run the build for this demo and read the first error in the compile log — later errors are usually downstream.",
        severity: "critical",
      };
    case "api":
      return {
        title: "API failure",
        cause:
          "A dependent API returned a gateway error or timed out. Typical causes are an expired key, a rate limit, or the upstream service being down.",
        fix: "Check the upstream service status and rotate/verify the API credentials used by this demo, then re-check.",
        severity: "high",
      };
    case "database":
      return {
        title: "Database connection failure",
        cause:
          "The application could not open a connection: wrong connection string, exhausted pool, or the database rejected the host.",
        fix: "Reconnect the database from the one-click actions panel, then verify the connection string and IP allow-list.",
        severity: "critical",
      };
    case "login":
      return {
        title: "Login failure",
        cause:
          "The demo credentials were rejected. Either the seeded demo user was wiped by a reset, or the auth provider changed.",
        fix: "Re-seed the demo login roles and confirm the credentials stored against this demo still authenticate.",
        severity: "medium",
      };
  }
};

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

export const daysUntil = (date: string | null): number | null => {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
};

export const relativeTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60_000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};
