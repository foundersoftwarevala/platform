/**
 * Shared helpers for classifying Supabase/PostgREST failures so the Demo
 * Manager UI can tell "there is genuinely nothing here" apart from
 * "row-level security / grants are blocking this read".
 */

export type DataAccessKind = "permission" | "auth" | "network" | "unknown";

export interface DataAccessCheck {
  /** What to verify in the database. */
  label: string;
  /** Why it matters / how to confirm it. */
  detail: string;
  /** Optional SQL to run for the check. */
  sql?: string;
}

export interface DataAccessDiagnosis {
  kind: DataAccessKind;
  title: string;
  message: string;
  /** Actionable next steps shown as a checklist in the UI. */
  steps: string[];
  raw?: string;
  /** Postgres / PostgREST error code, when the backend supplied one. */
  code?: string;
  /** HTTP status, when present on the error object. */
  status?: number;
  details?: string;
  hint?: string;
  /** Plain-language explanation of what the specific code means. */
  explanation: string;
  /** Database policy / grant checks to verify, shown in the diagnostics modal. */
  checks: DataAccessCheck[];
}

/** Human explanation per known backend error code. */
const CODE_EXPLANATIONS: Record<string, string> = {
  "42501": "Postgres refused the statement: the role executing the query has no table privilege (a missing GRANT), or a write violated a row-level security WITH CHECK expression.",
  PGRST301: "PostgREST rejected the JWT or the role it maps to could not access the resource — usually an expired token or a role without access to the schema.",
  PGRST116: "The query returned no rows where exactly one was expected. With RLS enabled this normally means the row exists but the SELECT policy filtered it out for your role.",
  PGRST204: "PostgREST could not find the requested column or resource for your role — often a policy or schema-cache mismatch.",
  "428C9": "The target column is generated and cannot be written to directly.",
  "23503": "A foreign key referenced a row your role cannot see or that does not exist.",
};

const genericExplanation = (kind: DataAccessKind) =>
  kind === "permission"
    ? "The request reached the database and was rejected by row-level security or table privileges, so no rows were returned."
    : kind === "auth"
      ? "The request was made without a valid session token, so the database treated it as the anonymous role."
      : kind === "network"
        ? "The request never completed — the backend was unreachable or timed out."
        : "The backend returned an error that does not match a known permission, auth or network pattern.";

const tableFromResource = (resource: string): string => {
  const lower = resource.toLowerCase();
  if (lower.includes("request")) return "demo_requests";
  if (lower.includes("log") || lower.includes("activity") || lower.includes("audit")) return "audit_logs";
  if (lower.includes("alert") || lower.includes("health") || lower.includes("broken")) return "demo_health";
  if (lower.includes("click") || lower.includes("analytic")) return "demo_clicks";
  return "demos";
};

/** Concrete database checks for a permission/auth failure on a given resource. */
export const policyChecksFor = (resource: string): DataAccessCheck[] => {
  const table = tableFromResource(resource);
  return [
    {
      label: `Table privileges exist on public.${table}`,
      detail:
        "PostgREST needs an explicit GRANT per role; RLS policies alone are not enough. Missing grants surface as error 42501 (permission denied).",
      sql: `select grantee, privilege_type\n  from information_schema.role_table_grants\n where table_schema = 'public' and table_name = '${table}';`,
    },
    {
      label: `A SELECT policy on public.${table} matches your role`,
      detail:
        "If every policy scopes to a role you do not hold, reads succeed but return zero rows instead of an error.",
      sql: `select policyname, cmd, roles, qual\n  from pg_policies\n where schemaname = 'public' and tablename = '${table}';`,
    },
    {
      label: "Your user holds the demo_manager role",
      detail:
        "Demo Manager policies check the role table via the has_role security-definer function; without the row the policy evaluates to false.",
      sql: `select role from public.user_roles where user_id = auth.uid();`,
    },
    {
      label: "The request carried a valid session token",
      detail:
        "An expired or missing JWT makes the query run as the anonymous role, which most Demo Manager policies exclude (PGRST301 / HTTP 401).",
    },
  ];
};


const PERMISSION_CODES = new Set([
  "42501", // insufficient_privilege (missing GRANT)
  "PGRST301", // JWT / role cannot access resource
  "PGRST116", // no rows returned where policy hides them
  "PGRST204",
]);

const PERMISSION_PATTERNS = [
  "permission denied",
  "row-level security",
  "row level security",
  "violates row-level security",
  "not authorized",
  "insufficient_privilege",
  "no suitable key",
];

const AUTH_PATTERNS = [
  "jwt expired",
  "invalid jwt",
  "jwt must be provided",
  "missing authorization",
  "invalid claim",
  "session missing",
  "no api key",
];

const errorText = (error: unknown): string => {
  if (!error) return "";
  if (typeof error === "string") return error;
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  return [e.code, e.message, e.details, e.hint].filter(Boolean).join(" | ");
};

const matches = (haystack: string, needles: string[]) =>
  needles.some((n) => haystack.includes(n));

export const isPermissionError = (error: unknown): boolean => {
  if (!error) return false;
  const code = (error as { code?: string }).code;
  if (code && PERMISSION_CODES.has(code)) return true;
  return matches(errorText(error).toLowerCase(), PERMISSION_PATTERNS);
};

export const isAuthError = (error: unknown): boolean => {
  if (!error) return false;
  const status = (error as { status?: number }).status;
  if (status === 401) return true;
  return matches(errorText(error).toLowerCase(), AUTH_PATTERNS);
};

/**
 * Turns any read failure into a human message with concrete next steps.
 * Pass `hasSession` so the copy can distinguish "sign in" from
 * "you are signed in but your role is missing demo access".
 */
export const diagnoseDataAccess = (
  error: unknown,
  options: { hasSession?: boolean; resource?: string } = {},
): DataAccessDiagnosis => {
  const resource = options.resource ?? "this data";
  const raw = errorText(error) || undefined;
  const e = (error ?? {}) as { code?: string; status?: number; details?: string; hint?: string };
  const meta = { code: e.code, status: e.status, details: e.details, hint: e.hint, raw };
  const explain = (kind: DataAccessKind) =>
    (e.code && CODE_EXPLANATIONS[e.code]) || genericExplanation(kind);

  if (isAuthError(error) || (isPermissionError(error) && options.hasSession === false)) {
    return {
      kind: "auth",
      title: "Sign-in required",
      message: `${resource} is protected by Demo Manager access rules, and this browser has no active Software Vala session.`,
      steps: [
        "Sign in to Software Vala with your Demo Manager account in this browser.",
        "Ask an admin to grant your account the demo_manager role if you do not have it yet.",
        "Reload this page once the session is active — data loads automatically.",
      ],
      ...meta,
      explanation: explain("auth"),
      checks: policyChecksFor(resource),
    };
  }

  if (isPermissionError(error)) {
    return {
      kind: "permission",
      title: "Demo Manager access required",
      message: `The backend accepted the request but its access policies hid ${resource} from your current role.`,
      steps: [
        "Confirm your account has the demo_manager role assigned in user_roles.",
        "Ask an admin to add your user to the Demo Manager team, then reload.",
        "If you are an admin: verify the read policy and table grants for this resource.",
      ],
      ...meta,
      explanation: explain("permission"),
      checks: policyChecksFor(resource),
    };
  }

  const lower = errorText(error).toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("timeout")) {
    return {
      kind: "network",
      title: "Cannot reach the backend",
      message: `${resource} could not be loaded because the backend did not respond.`,
      steps: [
        "Check your network connection and retry.",
        "If the problem persists, the Software Vala backend may be temporarily unavailable.",
      ],
      ...meta,
      explanation: explain("network"),
      checks: [],
    };
  }

  return {
    kind: "unknown",
    title: "Could not load data",
    message: `Something went wrong while loading ${resource}.`,
    steps: ["Retry the request.", "If it keeps failing, share the technical detail below with an admin."],
    ...meta,
    explanation: explain("unknown"),
    checks: policyChecksFor(resource),
  };
};

