/**
 * The Marketplace Manager's real HTTP surface.
 *
 * Section 3 asks for a REST registry and says twice not to invent endpoints.
 * These are not invented: every entry below is a handler that exists in
 * src/routes/api, and the auth column is the guard that handler actually runs.
 * The screen probes them, so a registry that drifted from the code shows up as
 * a mismatch rather than as documentation nobody checked.
 *
 * A word on what is deliberately not here. api_keys, api_services, rate_limits
 * and api_request_logs all exist on this database and none of them describe
 * this API - they belong to the AI API Manager and hold the platform's outbound
 * calls to Razorpay, ElevenLabs and the AI gateways. Reusing them for a
 * Marketplace developer API would put two unrelated meanings in one table,
 * which is the duplication section 39 is warning about, just in the other
 * direction.
 */

export type AuthMode = "public" | "operator";

export type ApiEndpoint = {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  version: "v1";
  description: string;
  capability: string;
  auth: AuthMode;
  /** The matrix permission the handler checks, where it checks one. */
  permission: string | null;
  /** The scope a future key would need. Named after the permission it maps to. */
  scope: string;
  status: "active";
  file: string;
};

const OPERATOR = "Operator: an x-internal-token header, or a signed-in operator's bearer token that mm_is_operator() accepts.";
const PUBLIC = "None. This is storefront-facing and returns only what a visitor may see.";

export const AUTH_MODES: Record<AuthMode, string> = { public: PUBLIC, operator: OPERATOR };

export const ENDPOINTS: ApiEndpoint[] = [
  /* ------------------------------------------------------- storefront */
  {
    id: "catalog.list", name: "Marketplace catalogue", method: "GET",
    path: "/api/marketplace/catalog", version: "v1",
    description: "Published products for the storefront, already filtered to what a visitor may see.",
    capability: "Products", auth: "public", permission: null,
    scope: "marketplace.products.read", status: "active",
    file: "src/routes/api/marketplace/catalog.ts",
  },
  {
    id: "search.query", name: "Marketplace search", method: "GET",
    path: "/api/marketplace/search", version: "v1",
    description: "Search over published products.",
    capability: "Search", auth: "public", permission: null,
    scope: "marketplace.products.read", status: "active",
    file: "src/routes/api/marketplace/search.ts",
  },
  {
    id: "rows.read", name: "Homepage rows", method: "GET",
    path: "/api/marketplace/rows", version: "v1",
    description:
      "The composed homepage rows the storefront renders. Public by design, and the guard decides what comes back rather than whether to answer: an anonymous caller gets the rows with hidden ones filtered out, an operator gets all of them.",
    capability: "Homepage", auth: "public", permission: null,
    scope: "marketplace.products.read", status: "active",
    file: "src/routes/api/marketplace/rows.ts",
  },
  {
    id: "proof.read", name: "Social proof", method: "GET",
    path: "/api/marketplace/proof", version: "v1",
    description: "Stories, awards and the proof strip the homepage shows.",
    capability: "Homepage", auth: "public", permission: null,
    scope: "marketplace.products.read", status: "active",
    file: "src/routes/api/marketplace/proof.ts",
  },
  {
    id: "activity.read", name: "Live activity", method: "GET",
    path: "/api/marketplace/activity", version: "v1",
    description: "Recent marketplace activity for the storefront ticker.",
    capability: "Analytics", auth: "public", permission: null,
    scope: "marketplace.analytics.read", status: "active",
    file: "src/routes/api/marketplace/activity.ts",
  },
  {
    id: "country.read", name: "Visitor country", method: "GET",
    path: "/api/marketplace/country", version: "v1",
    description: "The visitor's country, for pricing and language defaults.",
    capability: "Settings", auth: "public", permission: null,
    scope: "marketplace.products.read", status: "active",
    file: "src/routes/api/marketplace/country.ts",
  },
  {
    id: "lead.create", name: "Create lead", method: "POST",
    path: "/api/marketplace/lead", version: "v1",
    description: "Records an enquiry, resolves the product, dedupes, scores and assigns it.",
    capability: "Leads", auth: "public", permission: null,
    scope: "marketplace.leads.write", status: "active",
    file: "src/routes/api/marketplace/lead.ts",
  },
  {
    id: "track.event", name: "Track interaction", method: "POST",
    path: "/api/marketplace/track", version: "v1",
    description: "Records a storefront interaction. Deduped by key; bot traffic refused.",
    capability: "Analytics", auth: "public", permission: null,
    scope: "marketplace.analytics.write", status: "active",
    file: "src/routes/api/marketplace/track.ts",
  },
  {
    id: "translate.text", name: "Translate", method: "POST",
    path: "/api/marketplace/translate", version: "v1",
    description: "Translates storefront strings through the configured translation provider.",
    capability: "AI", auth: "public", permission: null,
    scope: "marketplace.ai.generate", status: "active",
    file: "src/routes/api/marketplace/translate.ts",
  },

  /* --------------------------------------------------------- operator */
  {
    id: "resource.list", name: "Read a resource", method: "GET",
    path: "/api/manager/resource", version: "v1",
    description: "Reads any whitelisted manager resource, with server-side filter, sort and paging.",
    capability: "Products, Categories, Orders and 30 more", auth: "operator",
    permission: "marketplace.view", scope: "marketplace.products.read", status: "active",
    file: "src/routes/api/manager/resource.ts",
  },
  {
    id: "resource.create", name: "Create a record", method: "POST",
    path: "/api/manager/resource", version: "v1",
    description: "Creates a record in a whitelisted resource. Audited with a content hash.",
    capability: "Products, Categories and more", auth: "operator",
    permission: "marketplace.create", scope: "marketplace.products.write", status: "active",
    file: "src/routes/api/manager/resource.ts",
  },
  {
    id: "resource.update", name: "Update a record", method: "PATCH",
    path: "/api/manager/resource", version: "v1",
    description: "Updates whitelisted fields. Before and after are both audited.",
    capability: "Products, Categories and more", auth: "operator",
    permission: "marketplace.edit", scope: "marketplace.products.write", status: "active",
    file: "src/routes/api/manager/resource.ts",
  },
  {
    id: "resource.retire", name: "Retire a record", method: "DELETE",
    path: "/api/manager/resource", version: "v1",
    description: "Retires a record where the resource permits it.",
    capability: "Products and more", auth: "operator",
    permission: "marketplace.delete", scope: "marketplace.products.write", status: "active",
    file: "src/routes/api/manager/resource.ts",
  },
  {
    id: "bulk.run", name: "Bulk operation", method: "POST",
    path: "/api/manager/bulk", version: "v1",
    description: "Preview then run a bulk update or retire over up to 500 records, with per-record outcomes.",
    capability: "Products and more", auth: "operator",
    permission: "marketplace.edit", scope: "marketplace.products.write", status: "active",
    file: "src/routes/api/manager/bulk.ts",
  },
  {
    id: "row-action.run", name: "Row action", method: "POST",
    path: "/api/manager/row-action", version: "v1",
    description: "Publish, unpublish, archive, restore, duplicate or view. State machine and permission both enforced here.",
    capability: "Product lifecycle", auth: "operator",
    permission: "varies by action", scope: "marketplace.products.write", status: "active",
    file: "src/routes/api/manager/row-action.ts",
  },
  {
    id: "rows.configure", name: "Configure homepage rows", method: "PATCH",
    path: "/api/marketplace/rows", version: "v1",
    description: "Changes a homepage row's composition.",
    capability: "Homepage", auth: "operator",
    permission: "marketplace.edit", scope: "marketplace.products.write", status: "active",
    file: "src/routes/api/marketplace/rows.ts",
  },
  {
    id: "permissions.read", name: "Read the permission matrix", method: "GET",
    path: "/api/marketplace/permissions", version: "v1",
    description: "The role and permission matrix the guard consults on every request.",
    capability: "Governance", auth: "operator",
    permission: "marketplace.view", scope: "marketplace.settings.read", status: "active",
    file: "src/routes/api/marketplace/permissions.ts",
  },
  {
    id: "permissions.write", name: "Grant or revoke a permission", method: "PATCH",
    path: "/api/marketplace/permissions", version: "v1",
    description: "Grants or revokes one permission for one role. Owner tier only; denials are recorded.",
    capability: "Governance", auth: "operator",
    permission: "marketplace.permissions.configure", scope: "marketplace.settings.write", status: "active",
    file: "src/routes/api/marketplace/permissions.ts",
  },
  {
    id: "colour.read", name: "Read the palette", method: "GET",
    path: "/api/marketplace/colour", version: "v1",
    description: "Semantic colour tokens with contrast reported against both grounds.",
    capability: "Settings", auth: "operator",
    permission: "marketplace.view", scope: "marketplace.settings.read", status: "active",
    file: "src/routes/api/marketplace/colour.ts",
  },
  {
    id: "colour.write", name: "Change the palette", method: "PATCH",
    path: "/api/marketplace/colour", version: "v1",
    description: "Saves or resets the palette. Hex only; RGB and HSL are derived.",
    capability: "Settings", auth: "operator",
    permission: "marketplace.colors.configure", scope: "marketplace.settings.write", status: "active",
    file: "src/routes/api/marketplace/colour.ts",
  },
  {
    id: "automation.read", name: "Automation console", method: "GET",
    path: "/api/marketplace/automation", version: "v1",
    description: "Scheduler health, real job records, AI routing and backup state. format=csv exports the health report.",
    capability: "Automation", auth: "operator",
    permission: "marketplace.automation.view", scope: "marketplace.automation.read", status: "active",
    file: "src/routes/api/marketplace/automation.ts",
  },
  {
    id: "automation.run", name: "Run an automation", method: "POST",
    path: "/api/marketplace/automation", version: "v1",
    description: "Runs one of the sweeps the host scheduler already calls. Preview changes nothing.",
    capability: "Automation", auth: "operator",
    permission: "marketplace.automation.run", scope: "marketplace.automation.write", status: "active",
    file: "src/routes/api/marketplace/automation.ts",
  },
  {
    id: "micro.read", name: "Micro-interaction configuration", method: "GET",
    path: "/api/marketplace/micro-interactions", version: "v1",
    description: "Per-interaction enablement, surfaces and readiness, with real usage counts.",
    capability: "Storefront", auth: "operator",
    permission: "marketplace.micro.view", scope: "marketplace.settings.read", status: "active",
    file: "src/routes/api/marketplace/micro-interactions.ts",
  },
  {
    id: "micro.write", name: "Configure micro-interactions", method: "PATCH",
    path: "/api/marketplace/micro-interactions", version: "v1",
    description: "Validates then saves the configuration, versioned and audited. Reset restores the defaults.",
    capability: "Storefront", auth: "operator",
    permission: "marketplace.micro.manage", scope: "marketplace.settings.write", status: "active",
    file: "src/routes/api/marketplace/micro-interactions.ts",
  },
  {
    id: "media.list", name: "Media catalogue", method: "GET",
    path: "/api/marketplace/media", version: "v1",
    description: "Every asset across storage and the module tables, searchable and paged. format=csv exports metadata.",
    capability: "Media", auth: "operator",
    permission: "marketplace.media.view", scope: "marketplace.media.read", status: "active",
    file: "src/routes/api/marketplace/media.ts",
  },
  {
    id: "media.sign", name: "Sign a media download", method: "POST",
    path: "/api/marketplace/media", version: "v1",
    description: "Issues a five-minute signed link. Legal documents are refused; traversal is refused.",
    capability: "Media", auth: "operator",
    permission: "marketplace.media.download", scope: "marketplace.media.read", status: "active",
    file: "src/routes/api/marketplace/media.ts",
  },
];

/** Scopes, derived from the endpoints rather than declared beside them. */
export function scopes(): { scope: string; endpoints: number; read: boolean }[] {
  const counts = new Map<string, number>();
  for (const e of ENDPOINTS) counts.set(e.scope, (counts.get(e.scope) ?? 0) + 1);
  return [...counts.entries()]
    .map(([scope, endpoints]) => ({ scope, endpoints, read: scope.endsWith(".read") }))
    .sort((a, b) => a.scope.localeCompare(b.scope));
}

/** Section 24: OpenAPI generated from the registry, so it cannot drift from it. */
export function openApi(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    paths[e.path] = paths[e.path] ?? {};
    paths[e.path][e.method.toLowerCase()] = {
      operationId: e.id,
      summary: e.name,
      description: `${e.description} Authentication: ${AUTH_MODES[e.auth]}${e.permission ? ` Permission: ${e.permission}.` : ""}`,
      tags: [e.capability],
      security: e.auth === "operator" ? [{ internalToken: [] }, { operatorBearer: [] }] : [],
      responses: {
        "200": { description: "Success" },
        "400": { description: "The request was not valid" },
        "401": { description: "No operator credential was presented" },
        "403": { description: "Authenticated, but the role lacks the permission" },
        "404": { description: "No such record" },
        "409": { description: "The record's state does not allow this" },
        "502": { description: "The write was not saved" },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Software Vala Marketplace API",
      version: "1.0.0",
      description:
        "The endpoints the Marketplace Manager actually serves. Generated from the live registry, not written by hand.",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        internalToken: { type: "apiKey", in: "header", name: "x-internal-token" },
        operatorBearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    paths,
  };
}

/** Minimal YAML, so the export does not need a dependency. */
export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    return /[:#\-?{}[\],&*!|>'"%@`\n]/.test(value) ? JSON.stringify(value) : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((v) => `\n${pad}- ${toYaml(v, indent + 1).replace(/^\s+/, "")}`).join("");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([k, v]) => {
      const rendered = toYaml(v, indent + 1);
      const inline = typeof v !== "object" || v === null;
      return `\n${pad}${k}:${inline ? ` ${rendered}` : rendered.startsWith("\n") ? rendered : ` ${rendered}`}`;
    })
    .join("");
}
