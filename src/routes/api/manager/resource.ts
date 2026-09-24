import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * The Marketplace Manager's window onto the real marketplace.
 *
 * Almost every section of the manager was drawing hardcoded arrays, so nothing
 * an operator did there reached the storefront. Rather than hand-wire seventy
 * screens, this is one endpoint they can all read and write through.
 *
 * Safety comes from the whitelist below, not from the caller: only the tables
 * named here can be touched, only the columns named here can be read, and only
 * the columns named as editable can be changed. Anything else is refused, so a
 * crafted request cannot reach `api_keys` or rewrite a price.
 *
 *   GET    ?resource=products&search=&limit=&offset=
 *   PATCH  { resource, id, changes }
 */

type Resource = {
  table: string;
  /** Columns returned to the manager. */
  select: string[];
  /** Columns an operator may change from the manager. */
  editable: string[];
  /** Columns a search term is matched against. */
  searchable: string[];
  order: string;
  label: string;
  /** Columns held as a list in the database and edited as one line of text. */
  arrays?: string[];
  /** Columns that may be set when a row is created. Absent means no creating. */
  creatable?: string[];
  /** Columns required to have a value before a row can be created. */
  required?: string[];
  /**
   * How a row is retired. Nothing in this catalogue is deleted, so a resource
   * names the change that takes a row out of use instead.
   */
  archive?: Record<string, unknown>;
  /**
   * Real column -> the name the screen uses for it.
   *
   * Several screens were built against a real table and call one or two of its
   * columns something slightly different: the membership payments wall shows
   * "amount" for amount_usd, the audit wall shows "entity" and "target" for
   * entity_type and entity_id. Everything else about those screens already
   * matched, so this translates the difference rather than rewriting a screen
   * or leaving a real table with nothing able to read it.
   *
   * The whitelist above always names real columns, which is what keeps it
   * safe. Only rows on the way out and changes on the way in are translated.
   */
  rename?: Record<string, string>;
};

/** The name a screen uses for a real column. Unrenamed columns pass through. */
function outward(resource: Resource, column: string): string {
  return resource.rename?.[column] ?? column;
}

/**
 * The real column behind a name a screen used.
 *
 * Falls back to the name itself, so a screen that already uses real column
 * names needs no map and behaves exactly as before. A name that matches
 * nothing simply stays as it is and is then refused by the whitelist, which is
 * the same answer an unknown column has always got.
 */
function inward(resource: Resource, key: string): string {
  if (!resource.rename) return key;
  for (const [column, alias] of Object.entries(resource.rename)) {
    if (alias === key) return column;
  }
  return key;
}

/** One row, with its columns under the names the screen expects. */
function toScreen(resource: Resource, row: Record<string, unknown>): Record<string, unknown> {
  if (!resource.rename) return row;
  const out: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) out[outward(resource, column)] = value;
  return out;
}

/**
 * A stable fingerprint of a row.
 *
 * Keys are sorted so the same content always hashes the same way, whatever
 * order the database returned it in. Two equal hashes either side of a write
 * mean the write changed nothing - section 48.
 */
async function contentHash(row: unknown): Promise<string> {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([k]) => k !== "updated_at")
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, stable(v)]),
      );
    }
    return value;
  };
  const text = JSON.stringify(stable(row) ?? null);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Write the change to marketplace_audit_logs.
 *
 * Called with the operator's own Authorization header where there is one, so
 * mm_audit's auth.uid() resolves to the person who made the change rather than
 * to the service role. A failure is logged and never raised: losing the change
 * would be worse than losing the record of it, and the operator is told about
 * neither by being shown a false error.
 */
async function recordAudit(
  request: Request,
  entry: {
    action: string;
    entityType: string;
    entityId: string | null;
    before: unknown;
    after: unknown;
    reason: string;
  },
): Promise<void> {
  try {
    const authorization = request.headers.get("authorization");
    const anon =
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const asOperator = Boolean(authorization && anon);

    const [beforeHash, afterHash] = await Promise.all([
      entry.before === null || entry.before === undefined
        ? Promise.resolve(null)
        : contentHash(entry.before),
      entry.after === null || entry.after === undefined
        ? Promise.resolve(null)
        : contentHash(entry.after),
    ]);

    const response = await fetch(`${url()}/rest/v1/rpc/mm_audit`, {
      method: "POST",
      headers: asOperator
        ? { apikey: anon, Authorization: authorization!, "Content-Type": "application/json" }
        : {
            apikey: service,
            Authorization: `Bearer ${service}`,
            "Content-Type": "application/json",
          },
      body: JSON.stringify({
        p_action: entry.action,
        p_entity_type: entry.entityType,
        p_entity_id: entry.entityId,
        p_before:
          entry.before === undefined ? null : { row: entry.before, content_hash: beforeHash },
        p_after: entry.after === undefined ? null : { row: entry.after, content_hash: afterHash },
        p_reason:
          beforeHash && afterHash && beforeHash === afterHash
            ? `${entry.reason} (content unchanged — the hashes match)`
            : entry.reason,
      }),
    });
    if (!response.ok) {
      console.error("[manager] audit rejected", response.status, await response.text());
    }
  } catch (error) {
    console.error("[manager] audit threw", error);
  }
}

const RESOURCES: Record<string, Resource> = {
  // Customer stories and awards shown on the home page. Nothing appears there
  // until an operator sets `published`, which is what stopped the written-in
  // testimonials being shown as if real customers had said them.
  stories: {
    table: "marketplace_stories",
    select: [
      "id",
      "company",
      "quote",
      "author",
      "role",
      "metric",
      "metric_label",
      "product",
      "product_slug",
      "published",
      "sort_order",
      "updated_at",
    ],
    editable: [
      "company",
      "quote",
      "author",
      "role",
      "metric",
      "metric_label",
      "product",
      "product_slug",
      "published",
      "sort_order",
    ],
    searchable: ["company", "author", "product"],
    order: "sort_order.asc",
    label: "Success stories",
    // A story could be edited but never added, so the home page section
    // that reads this table could never show anything at all.
    creatable: [
      "company",
      "quote",
      "author",
      "role",
      "metric",
      "metric_label",
      "product",
      "product_slug",
      "published",
      "sort_order",
    ],
    required: ["company", "quote"],
    archive: { published: false },
  },
  awards: {
    table: "marketplace_awards",
    select: [
      "id",
      "category",
      "winner",
      "product_slug",
      "year",
      "published",
      "sort_order",
      "updated_at",
    ],
    editable: ["category", "winner", "product_slug", "year", "published", "sort_order"],
    searchable: ["category", "winner"],
    order: "sort_order.asc",
    label: "Awards",
    creatable: ["category", "winner", "product_slug", "year", "published", "sort_order"],
    required: ["category", "winner"],
    archive: { published: false },
  },
  // The addresses themselves. These never appear in a public response - the
  // catalogue's one stealable asset - but an operator has to be able to see and
  // change them, and this endpoint answers nobody else.
  demos: {
    table: "product_demo_urls",
    select: [
      "id",
      "product_id",
      "demo_name",
      "role_name",
      "url",
      "username",
      "password",
      "description",
      "environment",
      "status",
      "sort_order",
      "last_checked_at",
      "last_response_ms",
      "last_http_status",
      "last_result",
      "ssl_valid",
      "created_at",
      "updated_at",
    ],
    editable: [
      "demo_name",
      "role_name",
      "url",
      "username",
      "password",
      "description",
      "environment",
      "status",
      "sort_order",
      "last_checked_at",
      "last_response_ms",
      "last_http_status",
      "last_result",
      "ssl_valid",
    ],
    searchable: ["demo_name", "role_name", "status", "url"],
    order: "sort_order.asc",
    label: "Demo addresses",
    creatable: [
      "product_id",
      "demo_name",
      "role_name",
      "url",
      "username",
      "password",
      "description",
      "environment",
      "status",
      "sort_order",
    ],
    required: ["url"],
    archive: { status: "inactive" },
  },

  /** What an operator did to an address, kept where the team can see it. */
  demo_audit: {
    table: "demo_url_audit_log",
    select: ["id", "demo_url_id", "action", "actor_email", "metadata", "created_at"],
    editable: [],
    searchable: ["action", "actor_email"],
    order: "created_at.desc",
    label: "Demo address history",
    creatable: ["demo_url_id", "action", "actor_email", "metadata"],
    required: ["action"],
  },
  // The approval trail. Append-only in the database and read-only here:
  // a history that could be edited from a console is not a history.
  approval_history: {
    table: "author_approval_history",
    select: [
      "id",
      "submission_id",
      "revision",
      "action",
      "from_status",
      "to_status",
      "actor_id",
      "actor_role",
      "reason",
      "comment",
      "created_at",
    ],
    editable: [],
    searchable: ["action", "from_status", "to_status", "reason"],
    order: "created_at.desc",
    label: "Approval history",
  },

  /* ----------------------------------------------------------------
     The tables behind the sections that used to draw hardcoded arrays.
     Columns come from the database's own schema. Money, audit trails and
     scan results are read-only; content and configuration are editable,
     and a row is retired by its own table's flag rather than deleted.
     ---------------------------------------------------------------- */
  vendors: {
    table: "marketplace_vendors",
    select: [
      "id",
      "slug",
      "name",
      "country",
      "verified",
      "rating",
      "product_count",
      "visible",
      "created_at",
      "updated_at",
    ],
    editable: ["slug", "name", "country", "verified", "rating", "product_count", "visible"],
    searchable: ["slug", "name"],
    order: "created_at.desc",
    label: "Vendors",
    archive: { visible: false },
  },
  authors: {
    table: "marketplace_sellers",
    select: [
      "id",
      "owner_user_id",
      "display_name",
      "slug",
      "status",
      "payout_currency",
      "payout_metadata",
      "approved_by",
      "approved_at",
      "created_at",
      "updated_at",
      "seller_kind",
    ],
    editable: ["display_name", "slug", "status", "seller_kind"],
    searchable: ["slug", "status"],
    order: "created_at.desc",
    label: "Authors",
  },
  resellers: {
    table: "resellers",
    select: [
      "id",
      "name",
      "code",
      "email",
      "phone",
      "region",
      "tier",
      "status",
      "kyc_status",
      "company_name",
      "legal_name",
      "gst_number",
      "pan_number",
      "notes",
      "approved_by",
      "approved_at",
      "created_at",
      "updated_at",
      "user_id",
      "plan_code",
      "last_active_at",
    ],
    editable: [
      "name",
      "code",
      "email",
      "phone",
      "region",
      "tier",
      "status",
      "kyc_status",
      "company_name",
      "legal_name",
      "gst_number",
      "pan_number",
      "notes",
      "plan_code",
    ],
    searchable: ["name", "code", "email", "status"],
    order: "created_at.desc",
    label: "Resellers",
  },
  affiliate: {
    table: "marketplace_affiliate_partners",
    select: ["id", "user_id", "display_name", "status", "created_at", "updated_at"],
    editable: ["display_name", "status"],
    searchable: ["status"],
    order: "created_at.desc",
    label: "Affiliate",
  },
  influencer: {
    table: "influencer_profiles",
    select: [
      "id",
      "user_id",
      "application_id",
      "full_name",
      "email",
      "country",
      "region",
      "niche",
      "status",
      "created_at",
      "updated_at",
    ],
    editable: ["full_name", "email", "country", "region", "niche", "status"],
    searchable: ["email", "status"],
    order: "created_at.desc",
    label: "Influencer",
  },
  offers: {
    table: "marketplace_coupons",
    select: [
      "id",
      "code",
      "kind",
      "value",
      "currency",
      "minimum_subtotal",
      "max_redemptions",
      "expires_at",
      "active",
      "created_at",
    ],
    editable: ["code", "kind", "value", "currency", "max_redemptions", "active"],
    searchable: ["code", "kind"],
    order: "created_at.desc",
    label: "Offers",
    archive: { active: false },
  },
  popups: {
    table: "storefront_floating_elements",
    select: [
      "id",
      "key",
      "element_type",
      "name",
      "enabled",
      "desktop_enabled",
      "tablet_enabled",
      "mobile_enabled",
      "position",
      "offset_x",
      "offset_y",
      "theme",
      "icon",
      "label",
      "trigger_type",
      "trigger_value",
      "action_type",
      "action_target",
      "priority",
      "audience",
      "page_scope",
      "starts_at",
      "ends_at",
      "created_by",
      "updated_by",
      "created_at",
    ],
    editable: [
      "key",
      "element_type",
      "name",
      "enabled",
      "desktop_enabled",
      "tablet_enabled",
      "mobile_enabled",
      "position",
      "offset_x",
      "offset_y",
      "theme",
      "icon",
      "label",
      "trigger_type",
    ],
    searchable: ["name", "label"],
    order: "created_at.desc",
    label: "Popups",
    archive: { enabled: false },
  },
  walls: {
    table: "marketplace_row_config",
    select: [
      "category_id",
      "source_mode",
      "max_products",
      "auto_rule",
      "allow_cross_category",
      "allow_duplicates",
      "visible_desktop",
      "visible_tablet",
      "visible_mobile",
      "starts_at",
      "ends_at",
      "cta_label",
      "cta_href",
      "status",
      "updated_by",
      "updated_at",
      "created_at",
      "id",
      "key",
      "title",
      "row_kind",
      "sort_order",
      "subcategory",
      "created_by",
    ],
    editable: [
      "source_mode",
      "max_products",
      "auto_rule",
      "allow_cross_category",
      "allow_duplicates",
      "visible_desktop",
      "visible_tablet",
      "visible_mobile",
      "cta_label",
      "cta_href",
      "status",
      "key",
      "title",
      "row_kind",
    ],
    searchable: ["status", "title"],
    order: "sort_order.asc",
    label: "Walls",
  },
  partners: {
    table: "marketplace_affiliate_partners",
    select: ["id", "user_id", "display_name", "status", "created_at", "updated_at"],
    editable: ["display_name", "status"],
    searchable: ["status"],
    order: "created_at.desc",
    label: "Partners",
  },
  blog: {
    table: "seo_content_items",
    select: [
      "id",
      "title",
      "content_type",
      "target_keyword",
      "body",
      "word_count",
      "seo_score",
      "status",
      "url",
      "model",
      "published_at",
      "created_at",
      "updated_at",
    ],
    editable: [
      "title",
      "content_type",
      "target_keyword",
      "body",
      "word_count",
      "seo_score",
      "status",
      "url",
      "model",
    ],
    searchable: ["title", "status", "url"],
    order: "created_at.desc",
    label: "Blog",
  },
  media_library: {
    table: "brand_assets",
    select: [
      "id",
      "key",
      "name",
      "asset_type",
      "public_path",
      "mime_type",
      "width",
      "height",
      "size_bytes",
      "sha256",
      "version",
      "approved",
      "active",
      "approved_by",
      "approved_at",
      "created_at",
      "updated_at",
    ],
    editable: [
      "key",
      "name",
      "asset_type",
      "public_path",
      "mime_type",
      "width",
      "height",
      "size_bytes",
      "sha256",
      "version",
      "approved",
      "active",
    ],
    searchable: ["name"],
    order: "created_at.desc",
    label: "Media Library",
    archive: { active: false },
  },
  reports: {
    table: "seo_reports",
    select: [
      "id",
      "name",
      "report_type",
      "period_start",
      "period_end",
      "status",
      "summary",
      "generated_at",
      "created_at",
    ],
    editable: [],
    searchable: ["name", "status"],
    order: "created_at.desc",
    label: "Reports",
  },
  downloads: {
    table: "marketplace_downloads",
    select: ["id", "entitlement_id", "buyer_id", "version_id", "created_at"],
    editable: [],
    searchable: [],
    order: "created_at.desc",
    label: "Downloads",
  },
  security: {
    table: "security_findings",
    select: [
      "id",
      "job_id",
      "asset_id",
      "category",
      "result",
      "severity",
      "title",
      "evidence",
      "source",
      "confidence",
      "created_at",
    ],
    editable: [],
    searchable: ["category", "title"],
    order: "created_at.desc",
    label: "Security",
  },
  upload_scanner: {
    table: "security_scan_jobs",
    select: [
      "id",
      "asset_id",
      "status",
      "stages",
      "scanner_version",
      "provider",
      "provider_reference",
      "attempt",
      "error_category",
      "error_detail",
      "risk_score",
      "risk_level",
      "started_at",
      "completed_at",
      "created_at",
    ],
    editable: [],
    searchable: ["status"],
    order: "created_at.desc",
    label: "Upload Scanner",
  },
  brand_protect: {
    table: "brand_violation_cases",
    select: [
      "id",
      "case_no",
      "product_id",
      "seller_id",
      "rule_key",
      "surface",
      "asset_reference",
      "classification",
      "severity",
      "status",
      "evidence",
      "detection_source",
      "legal_reference",
      "resolved_by",
      "resolved_at",
      "created_at",
    ],
    editable: [
      "case_no",
      "rule_key",
      "surface",
      "asset_reference",
      "classification",
      "severity",
      "status",
      "evidence",
      "detection_source",
      "legal_reference",
    ],
    searchable: ["status"],
    order: "created_at.desc",
    label: "Brand Protect",
  },
  audit_history: {
    table: "marketplace_audit_logs",
    select: [
      "id",
      "actor_id",
      "action",
      "entity_type",
      "entity_id",
      "metadata",
      "created_at",
      "actor",
      "actor_role",
      "before_state",
      "after_state",
      "reason",
      "module",
      "request_id",
      "ip_address",
    ],
    editable: [],
    searchable: ["reason"],
    order: "created_at.desc",
    label: "Audit & History",
  },
  ai_providers: {
    table: "ai_providers",
    select: [
      "id",
      "name",
      "slug",
      "category",
      "status",
      "base_url",
      "region",
      "docs_url",
      "monthly_cost_usd",
      "created_at",
      "api_kind",
      "credential_env",
      "content_generation_enabled",
    ],
    editable: [],
    searchable: ["name", "slug", "category", "status"],
    order: "created_at.desc",
    label: "AI Providers",
  },
  integrations: {
    table: "api_integrations",
    select: [
      "id",
      "name",
      "provider_id",
      "category",
      "status",
      "direction",
      "auth_type",
      "webhook_url",
      "last_sync_at",
      "sync_frequency",
      "error_count",
      "created_at",
    ],
    editable: [
      "name",
      "category",
      "status",
      "direction",
      "auth_type",
      "webhook_url",
      "sync_frequency",
      "error_count",
    ],
    searchable: ["name", "category", "status"],
    order: "created_at.desc",
    label: "Integrations",
  },
  automation: {
    table: "automation_rules",
    select: [
      "id",
      "name",
      "trigger_type",
      "condition",
      "action_type",
      "action_config",
      "enabled",
      "last_run_at",
      "run_count",
      "created_at",
      "scope",
      "trigger_event",
      "condition_text",
      "action_text",
      "is_enabled",
      "runs_count",
      "updated_at",
    ],
    editable: [
      "name",
      "trigger_type",
      "condition",
      "action_type",
      "action_config",
      "enabled",
      "run_count",
      "scope",
      "trigger_event",
      "condition_text",
      "action_text",
      "is_enabled",
      "runs_count",
    ],
    searchable: ["name"],
    order: "created_at.desc",
    label: "Automation",
    archive: { enabled: false },
  },
  system: {
    table: "system_settings",
    select: ["id", "key", "label", "value", "value_type", "category", "description", "updated_at"],
    editable: ["key", "label", "value", "value_type", "category", "description"],
    searchable: ["label", "category"],
    order: "id.asc",
    label: "System",
  },
  settings: {
    table: "system_settings",
    select: ["id", "key", "label", "value", "value_type", "category", "description", "updated_at"],
    editable: ["key", "label", "value", "value_type", "category", "description"],
    searchable: ["label", "category"],
    order: "id.asc",
    label: "Settings",
  },
  support: {
    table: "support_tickets",
    select: [
      "id",
      "reference",
      "subject",
      "description",
      "customer_id",
      "customer_name",
      "channel",
      "category",
      "priority",
      "status",
      "assigned_to",
      "sla_minutes_remaining",
      "sla_breached",
      "first_response_at",
      "resolved_at",
      "csat",
      "created_at",
      "updated_at",
    ],
    editable: [
      "reference",
      "subject",
      "description",
      "customer_name",
      "channel",
      "category",
      "priority",
      "status",
      "sla_minutes_remaining",
      "sla_breached",
      "csat",
    ],
    searchable: ["subject", "category", "status"],
    order: "created_at.desc",
    label: "Support",
  },
  demo_domain: {
    table: "demo_domains",
    select: [
      "id",
      "product_id",
      "demo_ref",
      "slug",
      "hostname",
      "environment",
      "pattern",
      "status",
      "failure_reason",
      "dns_status",
      "dns_record_id",
      "ssl_status",
      "ssl_expires_at",
      "ssl_issuer",
      "server_instance_id",
      "deployment_id",
      "deployment_version",
      "password_hash",
      "password_set_at",
      "password_protected",
      "allow_indexing",
      "branding_policy_version",
      "branding_verified_at",
      "security_cleared_at",
      "published_at",
      "expires_at",
    ],
    editable: [
      "demo_ref",
      "slug",
      "hostname",
      "environment",
      "pattern",
      "status",
      "failure_reason",
      "dns_status",
      "ssl_status",
      "ssl_issuer",
      "deployment_version",
      "password_hash",
      "password_protected",
      "allow_indexing",
    ],
    searchable: ["slug", "status"],
    order: "created_at.desc",
    label: "Demo Domain",
  },
  demo_sandbox: {
    table: "demo_sandboxes",
    select: [
      "id",
      "sandbox_ref",
      "demo_id",
      "product_id",
      "server_instance_id",
      "deployment_id",
      "status",
      "failure_reason",
      "isolation_strategy",
      "isolation_verified_at",
      "baseline_version",
      "baseline_snapshot_id",
      "last_activity_at",
      "last_reset_at",
      "next_reset_at",
      "expires_at",
      "cleanup_after",
      "cleanup_status",
      "health",
      "last_health_at",
      "created_by",
      "created_at",
      "updated_at",
    ],
    editable: [
      "sandbox_ref",
      "status",
      "failure_reason",
      "isolation_strategy",
      "baseline_version",
      "cleanup_status",
      "health",
    ],
    searchable: ["status"],
    order: "created_at.desc",
    label: "Demo Sandbox",
  },
  qr_system: {
    table: "product_qr_codes",
    select: [
      "id",
      "product_id",
      "short_link_id",
      "qr_code",
      "target_url",
      "foreground",
      "background",
      "size",
      "error_correction",
      "quiet_zone",
      "version",
      "active",
      "scan_count",
      "last_scan_at",
      "created_by",
      "created_at",
    ],
    editable: [
      "qr_code",
      "target_url",
      "foreground",
      "background",
      "size",
      "error_correction",
      "quiet_zone",
      "version",
      "active",
      "scan_count",
    ],
    searchable: ["qr_code", "target_url"],
    order: "created_at.desc",
    label: "QR System",
    archive: { active: false },
  },
  contact: {
    table: "leads",
    select: [
      "id",
      "name",
      "email",
      "phone",
      "company",
      "industry",
      "source",
      "sub_source",
      "campaign",
      "category",
      "status",
      "priority",
      "temperature",
      "country",
      "state",
      "city",
      "requirements",
      "budget_range",
      "deal_value",
      "ai_score",
      "intent_score",
      "conversion_probability",
      "duplicate_score",
      "fraud_score",
      "is_duplicate",
      "duplicate_of",
    ],
    editable: [
      "name",
      "email",
      "phone",
      "company",
      "industry",
      "source",
      "sub_source",
      "campaign",
      "category",
      "status",
      "priority",
      "temperature",
      "country",
      "state",
    ],
    searchable: ["name", "email", "company", "category"],
    order: "created_at.desc",
    label: "Contact",
  },
  ai_content: {
    table: "ai_content_items",
    select: [
      "id",
      "product_id",
      "content_type",
      "language",
      "status",
      "content",
      "content_json",
      "ai_original",
      "ai_original_json",
      "human_edited",
      "edited_by",
      "edited_at",
      "provenance",
      "current_version",
      "context_hash",
      "stale",
      "stale_reason",
      "stale_since",
      "validation_state",
      "validation",
      "legal_state",
      "legal_findings",
      "legal_reviewed_by",
      "legal_reviewed_at",
      "duplicate_state",
      "duplicate_of",
    ],
    editable: [
      "content_type",
      "language",
      "status",
      "content",
      "content_json",
      "ai_original",
      "ai_original_json",
      "human_edited",
      "provenance",
      "current_version",
      "context_hash",
      "stale",
      "stale_reason",
      "validation_state",
    ],
    searchable: ["status"],
    order: "created_at.desc",
    label: "AI Content",
  },
  analytics: {
    table: "analytics_events",
    select: ["id", "user_id", "event_type", "payload", "created_at"],
    editable: [],
    searchable: ["event_type"],
    order: "created_at.desc",
    label: "Analytics",
  },
  quality_gate: {
    table: "product_moderation_policy",
    select: [
      "id",
      "recovery_days",
      "dual_approval",
      "auto_purge",
      "preserve_orders",
      "preserve_licenses",
      "preserve_reviews",
      "updated_by",
      "updated_at",
    ],
    editable: [
      "recovery_days",
      "dual_approval",
      "auto_purge",
      "preserve_orders",
      "preserve_licenses",
      "preserve_reviews",
    ],
    searchable: [],
    order: "id.asc",
    label: "Quality Gate",
  },
  // Vala TV. The home page reads these through sf_vala_tv; until now the only
  // screen that could edit them wrote to browser storage, so nothing an
  // operator typed ever left their own machine.
  vala_tv_videos: {
    table: "vala_tv_videos",
    select: [
      "id",
      "title",
      "url",
      "thumbnail_url",
      "duration",
      "description",
      "category_id",
      "product_id",
      "status",
      "featured",
      "position",
      "language",
      "country",
      "seo_title",
      "seo_description",
      "publish_at",
      "published_at",
      "created_at",
      "updated_at",
    ],
    editable: [
      "title",
      "url",
      "thumbnail_url",
      "duration",
      "description",
      "category_id",
      "product_id",
      "status",
      "featured",
      "position",
      "language",
      "country",
      "seo_title",
      "seo_description",
      "publish_at",
    ],
    searchable: ["title", "description"],
    creatable: ["title", "url", "category_id", "status", "position"],
    required: ["title"],
    order: "position.asc",
    retirable: true,
    label: "Vala TV video",
  },

  vala_tv_categories: {
    table: "vala_tv_categories",
    select: ["id", "name", "slug", "position", "visible", "archived", "created_at", "updated_at"],
    editable: ["name", "slug", "position", "visible", "archived"],
    searchable: ["name", "slug"],
    creatable: ["name", "slug", "position"],
    required: ["name"],
    order: "position.asc",
    retirable: true,
    label: "Vala TV category",
  },

  // The membership payments wall was built for this table column for column -
  // order number, plan, proof reference, currency, status, created - and only
  // ever differed in calling amount_usd "amount".
  reseller_membership_orders: {
    table: "reseller_membership_orders",
    select: [
      "id",
      "order_number",
      "plan_id",
      "amount_usd",
      "currency",
      "status",
      "payment_status",
      "approval_status",
      "proof_reference",
      "reseller_id",
      "membership_id",
      "created_at",
      "updated_at",
    ],
    // Read-only here. A membership order is priced by the server, and its
    // payment decision goes through verify_reseller_membership_payment
    // (Finance Manager → Reseller memberships), which checks the payment
    // evidence and activates the membership. Patching these columns directly
    // marked orders paid without either.
    editable: [],
    rename: { amount_usd: "amount" },
    searchable: ["order_number", "proof_reference", "payment_status"],
    order: "created_at.desc",
    label: "Reseller membership payment",
  },

  // The record of what happened. Ten real events, and until now no screen on
  // the platform could read a single one of them.
  audit_logs: {
    table: "audit_logs",
    select: [
      "id",
      "occurred_at",
      "actor",
      "action",
      "entity_type",
      "entity_id",
      "ip",
      "severity",
      "metadata",
    ],
    // Only the triage flag. Who acted, what they did, on what, and from where
    // are the whole point of an audit log and cannot be edited from a screen.
    editable: ["severity"],
    rename: { entity_type: "entity", entity_id: "target", occurred_at: "created_at" },
    searchable: ["actor", "action", "entity_type", "entity_id"],
    order: "occurred_at.desc",
    label: "Audit event",
  },

  // ---------------------------------------------------------------- reseller
  // Eleven reseller tables existed and no screen read any of them. These are
  // the ones a manager screen has business editing.
  reseller_membership_plans: {
    table: "reseller_membership_plans",
    select: [
      "id",
      "code",
      "name",
      "price_usd",
      "profit_percent",
      "validity_days",
      "features",
      "enabled",
      "recommended",
      "sort_order",
      "created_at",
      "updated_at",
    ],
    editable: [
      "name",
      "price_usd",
      "profit_percent",
      "validity_days",
      "features",
      "enabled",
      "recommended",
      "sort_order",
    ],
    arrays: ["features"],
    searchable: ["code", "name"],
    creatable: ["code", "name", "price_usd", "profit_percent", "validity_days", "sort_order"],
    required: ["code", "name", "price_usd"],
    order: "sort_order.asc",
    retirable: false,
    label: "Reseller membership plan",
  },

  reseller_commission_rules: {
    table: "reseller_commission_rules",
    select: [
      "id",
      "reseller_id",
      "plan_code",
      "product_id",
      "category_id",
      "rate_percent",
      "fixed_amount",
      "currency",
      "min_volume",
      "priority",
      "active",
      "created_at",
      "updated_at",
    ],
    editable: [
      "plan_code",
      "rate_percent",
      "fixed_amount",
      "currency",
      "min_volume",
      "priority",
      "active",
    ],
    searchable: ["plan_code", "currency"],
    creatable: ["plan_code", "rate_percent", "currency", "priority", "active"],
    required: ["plan_code"],
    order: "priority.asc",
    retirable: true,
    label: "Commission rule",
  },

  // Money. Readable here, written only by the flow that earns it.
  reseller_commissions: {
    table: "reseller_commissions",
    select: [
      "id",
      "reseller_id",
      "order_id",
      "order_item_id",
      "gross_amount",
      "commission_amount",
      "currency",
      "status",
      "payout_id",
      "created_at",
    ],
    editable: [],
    searchable: ["currency", "status"],
    order: "created_at.desc",
    retirable: false,
    label: "Commission",
  },

  reseller_payouts: {
    table: "reseller_payouts",
    select: [
      "id",
      "reseller_id",
      "amount",
      "currency",
      "status",
      "payment_method",
      "provider_reference",
      "failure_reason",
      "requested_at",
      "approved_at",
      "processed_at",
      "completed_at",
      "created_at",
    ],
    // Only the decision is editable from a screen; the amounts are not.
    editable: ["status", "payment_method", "failure_reason"],
    searchable: ["status", "currency", "provider_reference"],
    order: "created_at.desc",
    retirable: false,
    label: "Payout",
  },

  reseller_memberships: {
    table: "reseller_memberships",
    select: [
      "id",
      "reseller_id",
      "plan_code",
      "membership_state",
      "order_id",
      "activated_at",
      "expires_at",
      "renewal_at",
      "created_at",
    ],
    editable: ["membership_state", "expires_at", "renewal_at"],
    searchable: ["plan_code", "membership_state"],
    order: "created_at.desc",
    retirable: false,
    label: "Reseller membership",
  },

  reseller_notifications: {
    table: "reseller_notifications",
    select: [
      "id",
      "reseller_id",
      "audience",
      "type",
      "title",
      "body",
      "status",
      "scheduled_at",
      "created_at",
      "updated_at",
    ],
    editable: ["audience", "type", "title", "body", "status", "scheduled_at"],
    searchable: ["title", "body", "audience"],
    creatable: ["audience", "type", "title", "body", "status", "scheduled_at"],
    required: ["title", "body"],
    order: "created_at.desc",
    retirable: true,
    label: "Reseller notification",
  },

  // --------------------------------------------------------------- franchise
  // Sixteen franchise tables existed and no screen read any of them either.
  franchises: {
    table: "franchises",
    select: [
      "id",
      "code",
      "name",
      "owner_name",
      "business_name",
      "email",
      "phone",
      "status",
      "territory",
      "country",
      "state",
      "city",
      "commission_rate",
      "royalty_rate",
      "total_sales",
      "performance_score",
      "health",
      "conversion_rate",
      "sla_adherence",
      "active_resellers",
      "joined_date",
      "last_active",
      "created_at",
    ],
    editable: [
      "name",
      "owner_name",
      "business_name",
      "email",
      "phone",
      "status",
      "territory",
      "country",
      "state",
      "city",
      "commission_rate",
      "royalty_rate",
    ],
    searchable: ["code", "name", "owner_name", "email", "status"],
    creatable: [
      "code",
      "name",
      "owner_name",
      "business_name",
      "email",
      "phone",
      "status",
      "territory",
      "country",
      "state",
      "city",
      "commission_rate",
      "royalty_rate",
    ],
    required: ["name"],
    // The directory wall was built calling these three something else. The
    // screen keeps its own words and the table keeps its own columns.
    rename: { name: "franchise", commission_rate: "commission", total_sales: "revenue_mtd" },
    order: "created_at.desc",
    label: "Franchises",
  },

  franchise_applications: {
    table: "franchise_applications",
    select: [
      "id",
      "code",
      "business_name",
      "owner_name",
      "email",
      "phone",
      "requested_territory",
      "city",
      "state",
      "country",
      "business_type",
      "investment_capacity",
      "kyc_status",
      "status",
      "review_notes",
      "applied_at",
      "created_at",
    ],
    editable: ["status", "kyc_status", "review_notes", "requested_territory"],
    searchable: ["code", "business_name", "owner_name", "email", "status"],
    order: "created_at.desc",
    label: "Franchise applications",
  },

  franchise_leads: {
    table: "franchise_leads",
    select: [
      "id",
      "franchise_id",
      "name",
      "company",
      "value",
      "stage",
      "source",
      "notes",
      "created_at",
    ],
    editable: ["name", "company", "value", "stage", "source", "notes"],
    searchable: ["name", "company", "stage", "source"],
    creatable: ["name", "company", "value", "stage", "source", "notes"],
    required: ["name"],
    order: "created_at.desc",
    label: "Franchise leads",
  },

  franchise_branches: {
    table: "franchise_branches",
    select: [
      "id",
      "franchise_id",
      "code",
      "name",
      "city",
      "region",
      "manager",
      "status",
      "total_sales",
      "active_employees",
      "performance_score",
      "joined_date",
      "created_at",
    ],
    editable: ["name", "city", "region", "manager", "status"],
    searchable: ["code", "name", "city", "region", "manager"],
    order: "created_at.desc",
    label: "Franchise branches",
  },

  franchise_employees: {
    table: "franchise_employees",
    select: [
      "id",
      "franchise_id",
      "branch_id",
      "full_name",
      "email",
      "role",
      "status",
      "performance",
      "availability",
      "joined_at",
      "created_at",
    ],
    editable: ["full_name", "email", "role", "status", "availability"],
    searchable: ["full_name", "email", "role", "status"],
    order: "created_at.desc",
    label: "Franchise employees",
  },

  franchise_compliance: {
    table: "franchise_compliance",
    select: [
      "id",
      "franchise_id",
      "requirement",
      "category",
      "status",
      "severity",
      "due_date",
      "last_checked",
      "notes",
      "created_at",
    ],
    editable: ["status", "severity", "due_date", "notes"],
    searchable: ["requirement", "category", "status"],
    order: "due_date.asc",
    label: "Franchise compliance",
  },

  franchise_documents: {
    table: "franchise_documents",
    select: [
      "id",
      "franchise_id",
      "application_id",
      "name",
      "doc_type",
      "status",
      "file_url",
      "uploaded_at",
      "expires_at",
      "created_at",
    ],
    editable: ["name", "doc_type", "status", "expires_at"],
    searchable: ["name", "doc_type", "status"],
    order: "uploaded_at.desc",
    label: "Franchise documents",
  },

  franchise_contracts: {
    table: "franchise_contracts",
    select: [
      "id",
      "franchise_id",
      "contract_no",
      "contract_type",
      "start_date",
      "end_date",
      "value",
      "status",
      "renewal_status",
      "signed_at",
      "created_at",
    ],
    editable: ["status", "renewal_status", "end_date"],
    searchable: ["contract_no", "contract_type", "status"],
    order: "created_at.desc",
    label: "Franchise contracts",
  },

  // Money owed and money paid. The amounts are earned, not typed in.
  franchise_royalties: {
    table: "franchise_royalties",
    select: [
      "id",
      "franchise_id",
      "period",
      "gross_sales",
      "royalty_rate",
      "royalty_due",
      "commission_due",
      "paid_amount",
      "status",
      "due_date",
      "paid_at",
      "created_at",
    ],
    editable: ["status"],
    searchable: ["period", "status"],
    order: "due_date.desc",
    retirable: false,
    label: "Franchise royalties",
  },

  franchise_performance: {
    table: "franchise_performance",
    select: [
      "id",
      "franchise_id",
      "period",
      "revenue",
      "leads",
      "conversions",
      "tickets",
      "csat",
      "sla_percent",
      "created_at",
    ],
    editable: [],
    searchable: ["period"],
    order: "created_at.desc",
    retirable: false,
    label: "Franchise performance",
  },

  franchise_notifications: {
    table: "franchise_notifications",
    select: ["id", "franchise_id", "title", "message", "type", "read", "created_at"],
    editable: ["title", "message", "type", "read"],
    searchable: ["title", "message", "type"],
    creatable: ["title", "message", "type"],
    required: ["title"],
    order: "created_at.desc",
    retirable: true,
    label: "Franchise notification",
  },

  franchise_escalations: {
    table: "franchise_escalations",
    select: [
      "id",
      "franchise_id",
      "title",
      "category",
      "priority",
      "status",
      "raised_by",
      "assigned_to",
      "sla_due",
      "resolution",
      "created_at",
    ],
    editable: ["status", "priority", "assigned_to", "resolution"],
    searchable: ["title", "category", "status"],
    order: "created_at.desc",
    label: "Franchise escalations",
  },

  franchise_settings: {
    table: "franchise_settings",
    select: ["id", "key", "label", "description", "value", "updated_at"],
    editable: ["label", "description", "value"],
    searchable: ["key", "label"],
    order: "key.asc",
    label: "Franchise settings",
  },

  franchise_audit_logs: {
    table: "franchise_audit_logs",
    select: [
      "id",
      "actor",
      "action",
      "entity_type",
      "entity_id",
      "result",
      "details",
      "created_at",
    ],
    editable: [],
    searchable: ["actor", "action", "entity_type"],
    order: "created_at.desc",
    retirable: false,
    label: "Franchise audit",
  },

  franchise_fraud_alerts: {
    table: "franchise_fraud_alerts",
    select: [
      "id",
      "franchise_id",
      "alert_type",
      "severity",
      "risk_score",
      "description",
      "status",
      "detected_at",
      "created_at",
    ],
    editable: ["status", "severity"],
    searchable: ["alert_type", "severity", "status"],
    order: "detected_at.desc",
    label: "Franchise fraud alerts",
  },

  products: {
    table: "marketplace_products",
    select: [
      "id",
      "name",
      "slug",
      "industry_label",
      "price_label",
      "rating",
      "downloads_label",
      "badge",
      "visible",
      "is_featured",
      "is_trending",
      "is_best_seller",
      "is_new_release",
      "content_status",
      "demo_url",
      "sort_order",
      "category_id",
      "description",
      "search_keywords",
      "icon",
      "price_period",
      "downloads",
      "is_ai",
      "publish_at",
      "unpublish_at",
      "updated_at",
    ],
    // `search_keywords` is what the product's own meta tags and its country
    // targeting are built from. It had no way in from any screen, so the terms
    // that decide how a product is found could not be changed by the people
    // responsible for them. It is edited here as one line, comma separated.
    editable: [
      "name",
      "price_label",
      "badge",
      "visible",
      "is_featured",
      "is_trending",
      "is_best_seller",
      "is_new_release",
      "content_status",
      "sort_order",
      "industry_label",
      "description",
      "search_keywords",
      "icon",
      "price_period",
      "is_ai",
      "publish_at",
      "unpublish_at",
    ],
    arrays: ["search_keywords"],
    searchable: ["name", "slug", "industry_label"],
    order: "sort_order.asc",
    label: "Products",
    creatable: [
      "name",
      "slug",
      "industry_label",
      "icon",
      "price_label",
      "price_period",
      "badge",
      "visible",
      "is_featured",
      "is_trending",
      "is_best_seller",
      "is_new_release",
      "content_status",
      "sort_order",
      "category_id",
      "description",
      "search_keywords",
    ],
    required: ["name", "slug"],
    archive: { visible: false, content_status: "archived" },
  },
  categories: {
    table: "marketplace_categories",
    select: [
      "id",
      "name",
      "slug",
      "icon",
      "image_key",
      "tone",
      "sort_order",
      "is_hidden",
      "is_featured",
      "updated_at",
    ],
    editable: ["name", "icon", "image_key", "tone", "sort_order", "is_hidden", "is_featured"],
    searchable: ["name", "slug"],
    order: "sort_order.asc",
    label: "Categories",
    creatable: [
      "name",
      "slug",
      "icon",
      "image_key",
      "tone",
      "sort_order",
      "is_hidden",
      "is_featured",
    ],
    required: ["name", "slug"],
    archive: { is_hidden: true },
  },
  // The card slots: one permanent address per category and country, with the
  // SEO blueprint that belongs to the address rather than to whichever product
  // is in it. An operator may rewrite the blueprint and change the rotation
  // policy. The address - category, position, country, URL - is read-only
  // here, and so is the tenant: moving a product between slots belongs to the
  // Demo Manager's mapping, which keeps its own record of the change.
  card_slots: {
    table: "marketplace_card_slots",
    select: [
      "id",
      "slot_no",
      "country_marker",
      "country_code",
      "region",
      "slot_url",
      "slot_title",
      "status",
      "h1_template",
      "meta_title_template",
      "meta_description_template",
      "primary_keyword",
      "rotation_policy",
      "indexnow_enabled",
      "hreflang_group",
      "current_product_id",
      "occupied_since",
      "updated_at",
    ],
    editable: [
      "slot_title",
      "h1_template",
      "meta_title_template",
      "meta_description_template",
      "primary_keyword",
      "rotation_policy",
      "indexnow_enabled",
    ],
    searchable: ["slot_url", "country_marker", "slot_title", "status", "primary_keyword"],
    order: "slot_url.asc",
    label: "Card slots",
  },
  orders: {
    table: "marketplace_orders",
    select: [
      "id",
      "order_no",
      "order_number",
      "status",
      "total",
      "currency",
      "amount_inr",
      "currency_charged",
      "txnid",
      "payu_status",
      "payment_gateway",
      "buyer_id",
      "created_at",
    ],
    // An operator may cancel or reinstate an order, never edit its money.
    editable: ["status"],
    searchable: ["order_no", "order_number", "txnid", "status"],
    order: "created_at.desc",
    label: "Orders",
  },
  licences: {
    table: "licenses",
    select: [
      "id",
      "license_key",
      "order_id",
      "user_id",
      "product_id",
      "status",
      "issued_at",
      "revoked_at",
      "revoked_reason",
      "activation_count",
    ],
    editable: ["status", "revoked_reason"],
    searchable: ["license_key", "status"],
    order: "issued_at.desc",
    label: "Licences",
  },
  // Money returned. An operator decides whether a refund is granted; the
  // amount and the provider's own reference are what happened, not a choice.
  refunds: {
    table: "marketplace_order_refunds",
    select: [
      "id",
      "order_id",
      "provider",
      "provider_refund_id",
      "amount",
      "currency",
      "status",
      "reason",
      "created_at",
      "processed_at",
    ],
    editable: ["status", "reason"],
    searchable: ["status", "provider", "provider_refund_id"],
    order: "created_at.desc",
    retirable: false,
    label: "Refunds",
  },

  // How an order got to where it is.
  order_history: {
    table: "marketplace_order_status_history",
    select: ["id", "order_id", "from_status", "to_status", "actor_id", "created_at"],
    editable: [],
    searchable: ["from_status", "to_status"],
    order: "created_at.desc",
    retirable: false,
    label: "Order history",
  },

  // What a partner earned and what was paid to them. Amounts are what the
  // sale produced; an operator decides only whether to approve or reverse.
  partner_commissions: {
    table: "partner_commissions",
    select: [
      "id",
      "partner_kind",
      "partner_id",
      "order_id",
      "gross_amount",
      "commission_amount",
      "currency",
      "status",
      "payout_id",
      "earned_at",
      "approved_at",
    ],
    editable: ["status"],
    searchable: ["partner_kind", "status", "currency"],
    order: "earned_at.desc",
    retirable: false,
    label: "Partner commissions",
  },

  partner_payouts: {
    table: "partner_payouts",
    select: [
      "id",
      "partner_kind",
      "partner_id",
      "amount",
      "currency",
      "status",
      "payment_method",
      "provider",
      "provider_reference",
      "failure_reason",
      "period_start",
      "period_end",
      "requested_at",
      "approved_at",
      "completed_at",
    ],
    editable: ["status", "payment_method", "provider", "provider_reference", "failure_reason"],
    searchable: ["partner_kind", "status", "provider_reference"],
    order: "requested_at.desc",
    retirable: false,
    label: "Partner payouts",
  },

  affiliate_clicks: {
    table: "affiliate_clicks",
    select: [
      "id",
      "partner_id",
      "referral_code",
      "product_id",
      "landing_path",
      "referrer_host",
      "country",
      "device_type",
      "converted_order_id",
      "converted_at",
      "created_at",
    ],
    editable: [],
    searchable: ["referral_code", "country", "landing_path"],
    order: "created_at.desc",
    retirable: false,
    label: "Affiliate clicks",
  },

  // A scan of a QR code. The visitor is a one-way hash and the row carries
  // its own purge date, so this counts traffic rather than following anyone.
  qr_events: {
    table: "product_qr_events",
    select: [
      "id",
      "qr_id",
      "product_id",
      "campaign",
      "country",
      "device_type",
      "browser",
      "created_at",
    ],
    editable: [],
    searchable: ["campaign", "country", "device_type"],
    order: "created_at.desc",
    retirable: false,
    label: "QR scans",
  },

  // ----------------------------------------------------------------- finance
  // Twenty-three finance tables held two thousand rows between them and no
  // screen read one of them: the Finance Manager was asking billing_plans,
  // invoices, wallets and usage_daily, which are the API-billing tables and
  // are empty. These are the ones with the money in them.
  //
  // What an operator may change is a decision - approve, reject, mark settled.
  // An amount is what happened and is never editable from a screen.
  finance_transactions: {
    table: "finance_transactions",
    select: [
      "id",
      "txn_code",
      "direction",
      "amount",
      "counterparty",
      "counterparty_type",
      "category",
      "gateway",
      "method",
      "status",
      "region",
      "occurred_at",
      "notes",
    ],
    editable: ["status", "notes"],
    searchable: ["txn_code", "counterparty", "category", "status"],
    order: "occurred_at.desc",
    retirable: false,
    label: "Transactions",
  },
  finance_wallets: {
    table: "finance_wallets",
    select: [
      "id",
      "owner_type",
      "owner_name",
      "owner_code",
      "region",
      "balance",
      "currency",
      "low_balance_threshold",
      "status",
      "last_activity_at",
    ],
    editable: ["status", "low_balance_threshold"],
    searchable: ["owner_name", "owner_code", "status"],
    order: "balance.desc",
    retirable: false,
    label: "Wallets",
  },
  finance_wallet_transactions: {
    table: "finance_wallet_transactions",
    select: [
      "id",
      "wallet_id",
      "entry_type",
      "amount",
      "balance_after",
      "reference",
      "note",
      "status",
      "created_at",
    ],
    editable: ["status", "note"],
    searchable: ["reference", "entry_type", "status"],
    order: "created_at.desc",
    retirable: false,
    label: "Wallet movements",
  },
  finance_payouts: {
    table: "finance_payouts",
    select: [
      "id",
      "payout_code",
      "recipient_name",
      "recipient_type",
      "amount",
      "method",
      "bank_reference",
      "status",
      "requested_at",
      "processed_at",
      "reviewer_note",
    ],
    editable: ["status", "reviewer_note", "bank_reference"],
    searchable: ["payout_code", "recipient_name", "status"],
    order: "requested_at.desc",
    retirable: false,
    label: "Payouts",
  },
  finance_commissions: {
    table: "finance_commissions",
    select: [
      "id",
      "partner_name",
      "partner_type",
      "period",
      "base_amount",
      "rate_percent",
      "commission_amount",
      "status",
      "created_at",
    ],
    editable: ["status"],
    searchable: ["partner_name", "partner_type", "period", "status"],
    order: "created_at.desc",
    retirable: false,
    label: "Commissions",
  },
  finance_refunds: {
    table: "finance_refunds",
    select: [
      "id",
      "refund_code",
      "invoice_no",
      "customer_name",
      "amount",
      "reason",
      "mode",
      "status",
      "requested_at",
      "processed_at",
      "reviewer_note",
    ],
    editable: ["status", "reviewer_note"],
    searchable: ["refund_code", "invoice_no", "customer_name", "status"],
    order: "requested_at.desc",
    retirable: false,
    label: "Refunds",
  },
  finance_subscriptions: {
    table: "finance_subscriptions",
    select: [
      "id",
      "plan_id",
      "customer_name",
      "customer_type",
      "amount",
      "status",
      "auto_renew",
      "started_at",
      "expires_at",
      "previous_plan",
    ],
    editable: ["status", "auto_renew"],
    searchable: ["customer_name", "status"],
    order: "started_at.desc",
    label: "Subscriptions",
  },
  finance_expenses: {
    table: "finance_expenses",
    select: [
      "id",
      "category",
      "vendor",
      "description",
      "amount",
      "expense_date",
      "recurring",
      "status",
      "created_at",
    ],
    editable: ["status", "description", "category"],
    searchable: ["vendor", "category", "status"],
    creatable: [
      "category",
      "vendor",
      "description",
      "amount",
      "expense_date",
      "recurring",
      "status",
    ],
    required: ["category", "amount"],
    order: "expense_date.desc",
    label: "Expenses",
  },
  finance_tax_records: {
    table: "finance_tax_records",
    select: [
      "id",
      "period",
      "tax_type",
      "taxable_amount",
      "tax_amount",
      "filing_status",
      "due_date",
      "filed_at",
      "reference_no",
    ],
    editable: ["filing_status", "reference_no", "filed_at"],
    searchable: ["period", "tax_type", "filing_status"],
    order: "due_date.desc",
    retirable: false,
    label: "Tax records",
  },
  finance_approvals: {
    table: "finance_approvals",
    select: [
      "id",
      "request_type",
      "reference",
      "amount",
      "requested_by",
      "status",
      "notes",
      "created_at",
      "decided_at",
    ],
    editable: ["status", "notes"],
    searchable: ["request_type", "reference", "status"],
    order: "created_at.desc",
    retirable: false,
    label: "Approvals",
  },
  finance_fraud_alerts: {
    table: "finance_fraud_alerts",
    select: [
      "id",
      "alert_code",
      "risk_score",
      "entity",
      "txn_reference",
      "reason",
      "amount",
      "status",
      "detected_at",
      "resolved_at",
    ],
    editable: ["status"],
    searchable: ["alert_code", "entity", "status"],
    order: "detected_at.desc",
    retirable: false,
    label: "Fraud alerts",
  },
  finance_gateways: {
    table: "finance_gateways",
    select: [
      "id",
      "code",
      "name",
      "provider",
      "status",
      "success_rate",
      "fee_percent",
      "settlement_cycle",
      "monthly_volume",
      "monthly_txn_count",
      "last_sync_at",
    ],
    editable: ["status", "fee_percent", "settlement_cycle"],
    searchable: ["code", "name", "provider", "status"],
    order: "monthly_volume.desc",
    label: "Gateways",
  },
  finance_plans: {
    table: "finance_plans",
    select: ["id", "code", "name", "price", "billing_cycle", "status", "created_at"],
    editable: ["name", "price", "billing_cycle", "status"],
    searchable: ["code", "name", "status"],
    creatable: ["code", "name", "price", "billing_cycle", "status"],
    required: ["code", "name"],
    order: "price.asc",
    label: "Plans",
  },
  finance_daily_metrics: {
    table: "finance_daily_metrics",
    select: [
      "id",
      "metric_date",
      "revenue",
      "expenses",
      "profit",
      "inflow",
      "outflow",
      "txn_count",
    ],
    editable: [],
    searchable: [],
    order: "metric_date.desc",
    retirable: false,
    label: "Daily metrics",
  },

  // ---------------------------------------------- the rest of what is held
  // Found by surveying every table against everything the codebase reads:
  // eight thousand rows of SEO activity, two thousand rankings, and the
  // pricing of three and a half thousand products, none of it reachable from
  // any screen.
  seo_activity: {
    table: "seo_activity_log",
    select: ["id", "table_name", "record_id", "action", "actor", "approval_ref", "occurred_at"],
    editable: [],
    searchable: ["table_name", "action", "actor"],
    order: "occurred_at.desc",
    retirable: false,
    label: "SEO activity",
  },
  seo_rankings: {
    table: "seo_keyword_rankings",
    // A ranking row names its keyword only by id, and the Ranking screen is a
    // list of keywords. The last entry is the keyword carried along with each
    // measurement so the screen does not have to fetch three thousand keywords
    // to put a name against twenty-four of them. It is read-only, like the
    // rest of this resource.
    select: [
      "id",
      "keyword_id",
      "recorded_on",
      "position",
      "clicks",
      "impressions",
      "seo_keywords(keyword,target_url,country)",
    ],
    editable: [],
    searchable: [],
    order: "recorded_on.desc",
    retirable: false,
    label: "Keyword rankings",
  },
  seo_behaviour: {
    table: "seo_page_behavior",
    select: [
      "id",
      "page_url",
      "recorded_on",
      "sessions",
      "avg_time_seconds",
      "scroll_depth_pct",
      "clicks",
      "rage_clicks",
      "bounce_rate",
    ],
    editable: [],
    searchable: ["page_url"],
    order: "recorded_on.desc",
    retirable: false,
    label: "Page behaviour",
  },

  // What each product costs. An amount is what the catalogue says; whether a
  // price is the one in force is the decision a screen may take.
  product_pricing: {
    table: "marketplace_product_pricing",
    select: [
      "id",
      "product_id",
      "variant_id",
      "amount",
      "currency",
      "billing_period",
      "active",
      "created_at",
      "updated_at",
    ],
    editable: ["active", "billing_period"],
    searchable: ["currency", "billing_period"],
    order: "updated_at.desc",
    retirable: false,
    label: "Product pricing",
  },

  card_fields: {
    table: "marketplace_card_fields",
    select: [
      "id",
      "kind",
      "key",
      "label",
      "data_column",
      "enabled",
      "position",
      "hint",
      "priority",
    ],
    editable: ["label", "enabled", "position", "hint", "priority"],
    searchable: ["kind", "key", "label"],
    order: "position.asc",
    label: "Card fields",
  },

  faqs: {
    table: "faqs",
    select: [
      "id",
      "question",
      "answer",
      "category_id",
      "language",
      "status",
      "seo_title",
      "seo_description",
      "tags",
      "ai_generated",
      "position",
      "published_at",
      "updated_at",
    ],
    editable: [
      "question",
      "answer",
      "status",
      "position",
      "language",
      "seo_title",
      "seo_description",
    ],
    searchable: ["question", "answer", "language", "status"],
    creatable: ["question", "answer", "category_id", "language", "status", "position"],
    required: ["question", "answer"],
    order: "position.asc",
    label: "FAQs",
  },

  countries: {
    table: "registry_countries",
    select: ["code", "name", "region", "created_at"],
    editable: ["name", "region"],
    searchable: ["code", "name", "region"],
    order: "name.asc",
    retirable: false,
    label: "Countries",
  },
  languages: {
    table: "registry_languages",
    select: ["code", "name", "created_at"],
    editable: ["name"],
    searchable: ["code", "name"],
    order: "name.asc",
    retirable: false,
    label: "Languages",
  },

  order_items: {
    table: "marketplace_order_items",
    select: [
      "id",
      "order_id",
      "product_id",
      "product_name",
      "quantity",
      "unit_amount",
      "line_total",
      "currency",
      "created_at",
    ],
    editable: [],
    searchable: ["product_name"],
    order: "created_at.desc",
    retirable: false,
    label: "Order items",
  },

  payments: {
    table: "payment_logs",
    select: [
      "id",
      "order_id",
      "event_type",
      "provider",
      "signature_valid",
      "payload",
      "created_at",
    ],
    editable: [],
    searchable: ["event_type", "provider"],
    order: "created_at.desc",
    label: "Payment log",
  },
  invoices: {
    table: "finance_invoices",
    select: [
      "id",
      "invoice_no",
      "client_name",
      "total",
      "status",
      "issue_date",
      "auto_generated",
      "created_at",
    ],
    editable: ["status", "client_name"],
    searchable: ["invoice_no", "client_name", "status"],
    order: "issue_date.desc",
    label: "Invoices",
  },
  leads: {
    table: "leads",
    select: [
      "id",
      "name",
      "email",
      "phone",
      "company",
      "status",
      "source",
      "source_page",
      "cta_action",
      "requirements",
      "deal_value",
      "assigned_agent_id",
      "created_at",
    ],
    editable: ["status"],
    searchable: ["name", "email", "status", "source"],
    order: "created_at.desc",
    label: "Leads",
  },

  // The customers a reseller keeps. The Customers wall rendered whatever an
  // operator typed into their own browser while this table sat unread, so a
  // client added on a reseller's dashboard was invisible to the manager.
  customers: {
    table: "crm_customers",
    select: [
      "id",
      "company_name",
      "contact_name",
      "email",
      "phone",
      "industry",
      "country",
      "plan",
      "status",
      "health_score",
      "lifetime_value",
      "open_tickets",
      "owner_id",
      "last_contact_at",
      "created_at",
    ],
    editable: [
      "company_name",
      "contact_name",
      "email",
      "phone",
      "industry",
      "country",
      "plan",
      "status",
      "health_score",
    ],
    searchable: ["company_name", "contact_name", "email", "status"],
    creatable: [
      "company_name",
      "contact_name",
      "email",
      "phone",
      "industry",
      "country",
      "plan",
      "status",
      "health_score",
    ],
    required: ["contact_name"],
    order: "created_at.desc",
    label: "Customers",
  },
  mail: {
    table: "email_outbox",
    select: [
      "id",
      "to_email",
      "subject",
      "status",
      "attempts",
      "last_error",
      "order_id",
      "sent_at",
      "created_at",
    ],
    editable: ["status"],
    searchable: ["to_email", "subject", "status"],
    order: "created_at.desc",
    label: "Outbound mail",
  },
  keywords: {
    table: "seo_keywords",
    select: [
      "id",
      "keyword",
      "target_url",
      "country",
      "region",
      "industry",
      "intent",
      "status",
      "position",
      "previous_position",
      "search_volume",
      "difficulty",
      "cpc",
      "updated_at",
    ],
    editable: ["keyword", "target_url", "country", "industry", "intent", "status"],
    searchable: ["keyword", "country", "industry", "status"],
    order: "search_volume.desc",
    label: "SEO keywords",
  },

  // ------------------------------------------------------- the SEO console
  // Thirty-four tables, fifteen thousand rows, and the SEO Manager module
  // screens were drawing hardcoded arrays over all of it. These are the
  // tables behind those screens. Almost all are read-only here: a ranking, a
  // crawl result or a backlink is a measurement, and an operator does not get
  // to edit a measurement. What an operator may change is a decision - a
  // status, a target, a piece of copy they wrote.
  // Every public address a product answers on, and where it redirects.
  // The Redirects and Canonical screens were drawing four invented rows each
  // over this table.
  product_urls: {
    table: "product_urls",
    select: [
      "id",
      "product_id",
      "slug",
      "path",
      "language",
      "status",
      "redirect_to",
      "is_canonical",
      "generated_by",
      "created_at",
      "updated_at",
    ],
    editable: ["status", "redirect_to", "is_canonical"],
    searchable: ["slug", "path", "status", "language"],
    order: "updated_at.desc",
    label: "Product URLs",
  },
  // ------------------------------------------- the last of the finance tables
  // Six hundred and seventy-two hours of transaction activity, two hundred and
  // twenty-five days of AI spend, and the audit trail behind payment proofs.
  // None of the three was named anywhere in the code.
  finance_activity_heat: {
    table: "finance_activity_heat",
    select: ["id", "activity_date", "hour_slot", "txn_count", "volume"],
    editable: [],
    searchable: [],
    order: "activity_date.desc",
    label: "Activity by hour",
  },
  finance_ai_api_usage: {
    table: "finance_ai_api_usage",
    select: [
      "id",
      "provider",
      "service",
      "usage_date",
      "requests",
      "tokens",
      "cost",
      "billed_to",
      "created_at",
    ],
    editable: [],
    searchable: ["provider", "service", "billed_to"],
    order: "usage_date.desc",
    label: "AI and API spend",
  },
  // A budget and a threshold are decisions, so those can be changed; what was
  // spent against them is a measurement and cannot.
  finance_ai_controls: {
    table: "finance_ai_controls",
    select: [
      "id",
      "provider",
      "service",
      "status",
      "budget",
      "spike_threshold",
      "auto_stop_percent",
      "updated_at",
    ],
    editable: ["status", "budget", "spike_threshold", "auto_stop_percent"],
    searchable: ["provider", "service", "status"],
    order: "provider.asc",
    label: "AI spend controls",
  },
  // An audit row is never edited and never removed.
  payment_audit_logs: {
    table: "payment_audit_logs",
    select: [
      "id",
      "actor_id",
      "action",
      "intent_id",
      "payment_id",
      "amount",
      "status",
      "source_ip",
      "created_at",
    ],
    editable: [],
    searchable: ["action", "status"],
    order: "created_at.desc",
    label: "Payment audit",
  },
  // The ladder each role climbs, which the AMS role manager draws.
  ams_role_stages: {
    table: "ams_role_stages",
    select: ["id", "role", "stage", "title", "tagline", "min_xp", "created_at"],
    editable: ["title", "tagline", "min_xp"],
    searchable: ["role", "title"],
    order: "min_xp.asc",
    label: "Role stages",
  },
  seo_pages: {
    table: "seo_pages",
    select: [
      "id",
      "url",
      "title",
      "meta_title",
      "meta_description",
      "h1",
      "canonical_url",
      "word_count",
      "seo_score",
      "index_status",
      "page_type",
      "issues_count",
      "schema_json",
      "last_crawled_at",
      "updated_at",
    ],
    editable: [
      "title",
      "meta_title",
      "meta_description",
      "h1",
      "canonical_url",
      "index_status",
      "page_type",
    ],
    searchable: ["url", "title", "meta_title", "page_type", "index_status"],
    order: "seo_score.desc",
    label: "SEO pages",
  },
  seo_issues: {
    table: "seo_issues",
    select: [
      "id",
      "page_url",
      "issue_type",
      "category",
      "severity",
      "description",
      "fix_suggestion",
      "status",
      "detected_at",
      "resolved_at",
    ],
    editable: ["status"],
    searchable: ["page_url", "issue_type", "category", "severity", "status"],
    order: "detected_at.desc",
    label: "SEO issues",
  },
  seo_technical_checks: {
    table: "seo_technical_checks",
    select: ["id", "name", "category", "status", "detail", "affected_urls", "last_checked_at"],
    editable: ["status"],
    searchable: ["name", "category", "status"],
    order: "last_checked_at.desc",
    label: "Technical checks",
  },
  seo_performance: {
    table: "seo_performance_metrics",
    select: [
      "id",
      "recorded_on",
      "clicks",
      "impressions",
      "ctr",
      "avg_position",
      "organic_sessions",
      "conversions",
      "lcp_ms",
      "inp_ms",
      "cls",
    ],
    editable: [],
    searchable: [],
    order: "recorded_on.desc",
    label: "SEO performance",
  },
  seo_competitors: {
    table: "seo_competitors",
    select: [
      "id",
      "name",
      "domain",
      "region",
      "visibility_score",
      "keywords_count",
      "backlinks_count",
      "traffic_estimate",
      "domain_authority",
      "updated_at",
    ],
    editable: ["name", "domain", "region"],
    searchable: ["name", "domain", "region"],
    order: "domain_authority.desc",
    label: "Competitors",
  },
  seo_competitor_gaps: {
    table: "seo_competitor_gaps",
    select: [
      "id",
      "competitor_id",
      "keyword",
      "their_position",
      "our_position",
      "search_volume",
      "opportunity",
      "created_at",
    ],
    editable: [],
    searchable: ["keyword", "opportunity"],
    order: "search_volume.desc",
    label: "Competitor gaps",
  },
  seo_backlinks: {
    table: "seo_backlinks",
    select: [
      "id",
      "source_domain",
      "source_url",
      "target_url",
      "anchor_text",
      "domain_authority",
      "link_type",
      "status",
      "spam_score",
      "first_seen_at",
      "last_checked_at",
    ],
    editable: ["status"],
    searchable: ["source_domain", "target_url", "anchor_text", "link_type", "status"],
    order: "domain_authority.desc",
    label: "Backlinks",
  },
  seo_audits: {
    table: "seo_audits",
    select: [
      "id",
      "name",
      "status",
      "score",
      "pages_crawled",
      "issues_found",
      "breakdown",
      "started_at",
      "completed_at",
    ],
    editable: [],
    searchable: ["name", "status"],
    order: "started_at.desc",
    label: "SEO audits",
  },
  seo_indexing: {
    table: "seo_indexing_records",
    select: [
      "id",
      "url",
      "source",
      "crawl_status",
      "index_state",
      "http_status",
      "discovered_at",
      "last_crawled_at",
      "indexed_at",
      "notes",
    ],
    editable: ["index_state", "notes"],
    searchable: ["url", "source", "crawl_status", "index_state"],
    order: "last_crawled_at.desc",
    label: "Indexing",
  },
  seo_automations: {
    table: "seo_automations",
    select: [
      "id",
      "name",
      "automation_type",
      "description",
      "schedule",
      "status",
      "last_run_at",
      "next_run_at",
      "runs_count",
      "success_rate",
    ],
    editable: ["status", "schedule", "description"],
    searchable: ["name", "automation_type", "status"],
    order: "next_run_at.asc",
    label: "SEO automations",
  },
  seo_automation_runs: {
    table: "seo_automation_runs",
    select: [
      "id",
      "automation_id",
      "started_at",
      "finished_at",
      "status",
      "items_processed",
      "message",
    ],
    editable: [],
    searchable: ["status", "message"],
    order: "started_at.desc",
    label: "Automation runs",
  },
  seo_automation_flows: {
    table: "seo_automation_flows",
    select: [
      "id",
      "name",
      "trigger_event",
      "status",
      "executions",
      "conversion_rate",
      "updated_at",
    ],
    editable: ["status", "name"],
    searchable: ["name", "trigger_event", "status"],
    order: "executions.desc",
    label: "Automation flows",
  },
  seo_meta_rules: {
    table: "seo_meta_rules",
    select: [
      "id",
      "name",
      "url_pattern",
      "title_template",
      "description_template",
      "og_image_template",
      "priority",
      "applies_to",
      "status",
      "updated_at",
    ],
    editable: [
      "name",
      "url_pattern",
      "title_template",
      "description_template",
      "og_image_template",
      "priority",
      "applies_to",
      "status",
    ],
    searchable: ["name", "url_pattern", "applies_to", "status"],
    order: "priority.asc",
    label: "Meta rules",
  },
  seo_product_entries: {
    table: "seo_product_entries",
    select: [
      "id",
      "product_name",
      "category",
      "target_keywords",
      "meta_title",
      "meta_description",
      "structured_data",
      "status",
      "updated_at",
    ],
    editable: ["meta_title", "meta_description", "status"],
    searchable: ["product_name", "category", "status"],
    order: "updated_at.desc",
    label: "Product SEO",
  },
  seo_content: {
    table: "seo_content_items",
    select: [
      "id",
      "title",
      "content_type",
      "target_keyword",
      "word_count",
      "seo_score",
      "status",
      "url",
      "model",
      "published_at",
      "updated_at",
    ],
    editable: ["title", "status", "url", "target_keyword"],
    searchable: ["title", "content_type", "target_keyword", "status"],
    order: "updated_at.desc",
    label: "SEO content",
  },
  seo_ai_suggestions: {
    table: "seo_ai_suggestions",
    select: [
      "id",
      "target_type",
      "target_ref",
      "title",
      "suggestion",
      "impact",
      "confidence",
      "status",
      "model",
      "updated_at",
    ],
    editable: ["status"],
    searchable: ["title", "target_type", "impact", "status"],
    order: "confidence.desc",
    label: "AI suggestions",
  },
  seo_reels: {
    table: "seo_reels",
    select: [
      "id",
      "title",
      "platform",
      "duration_seconds",
      "status",
      "views",
      "model",
      "updated_at",
    ],
    editable: ["status", "title"],
    searchable: ["title", "platform", "status"],
    order: "updated_at.desc",
    label: "SEO reels",
  },
  seo_regions: {
    table: "seo_regions",
    select: [
      "id",
      "code",
      "name",
      "region_group",
      "flag",
      "keywords_count",
      "traffic_share",
      "growth_pct",
    ],
    editable: [],
    searchable: ["code", "name", "region_group"],
    order: "keywords_count.desc",
    label: "SEO regions",
  },
  seo_integrations: {
    table: "seo_integrations",
    select: ["id", "provider", "display_name", "category", "status", "last_sync_at", "updated_at"],
    editable: ["status"],
    searchable: ["provider", "display_name", "category", "status"],
    order: "display_name.asc",
    label: "SEO integrations",
  },
  seo_alerts: {
    table: "seo_alerts",
    select: ["id", "title", "message", "category", "severity", "acknowledged", "created_at"],
    editable: ["acknowledged"],
    searchable: ["title", "category", "severity"],
    order: "created_at.desc",
    label: "SEO alerts",
  },
  seo_reports_center: {
    table: "seo_reports",
    select: [
      "id",
      "name",
      "report_type",
      "period_start",
      "period_end",
      "status",
      "summary",
      "generated_at",
      "created_at",
    ],
    editable: ["status"],
    searchable: ["name", "report_type", "status"],
    order: "generated_at.desc",
    label: "SEO reports",
  },
  seo_leads: {
    table: "seo_leads",
    select: [
      "id",
      "full_name",
      "company",
      "email",
      "country",
      "source_channel",
      "source_keyword",
      "landing_url",
      "score",
      "stage",
      "estimated_value",
      "updated_at",
    ],
    editable: ["stage"],
    searchable: ["full_name", "company", "email", "country", "stage"],
    order: "score.desc",
    label: "SEO leads",
  },
  seo_social_posts: {
    table: "seo_social_posts",
    select: [
      "id",
      "platform",
      "content",
      "link_url",
      "status",
      "scheduled_at",
      "published_at",
      "impressions",
      "engagements",
    ],
    editable: ["status"],
    searchable: ["platform", "content", "status"],
    order: "created_at.desc",
    label: "Social posts",
  },
  seo_social_comments: {
    table: "seo_social_comments",
    select: [
      "id",
      "platform",
      "author",
      "comment",
      "sentiment",
      "status",
      "replied_at",
      "created_at",
    ],
    editable: ["status"],
    searchable: ["platform", "author", "sentiment", "status"],
    order: "created_at.desc",
    label: "Social comments",
  },
  seo_inbox: {
    table: "seo_inbox_messages",
    select: [
      "id",
      "channel",
      "contact_name",
      "contact_handle",
      "message",
      "status",
      "replied_at",
      "created_at",
    ],
    editable: ["status"],
    searchable: ["channel", "contact_name", "status"],
    order: "created_at.desc",
    label: "SEO inbox",
  },
  seo_email_campaigns: {
    table: "seo_email_campaigns",
    select: [
      "id",
      "name",
      "segment",
      "subject",
      "status",
      "sent_count",
      "opened_count",
      "clicked_count",
      "replied_count",
      "scheduled_at",
    ],
    editable: ["status"],
    searchable: ["name", "segment", "subject", "status"],
    order: "created_at.desc",
    label: "Email campaigns",
  },
  seo_ad_campaigns: {
    table: "seo_ad_campaigns",
    select: [
      "id",
      "name",
      "channel",
      "status",
      "budget",
      "spend",
      "impressions",
      "clicks",
      "conversions",
      "cpa",
      "roas",
      "starts_on",
      "ends_on",
    ],
    editable: ["status"],
    searchable: ["name", "channel", "status"],
    order: "spend.desc",
    label: "Ad campaigns",
  },
  seo_spam_events: {
    table: "seo_spam_events",
    select: ["id", "source_ip", "event_type", "detail", "country", "blocked", "created_at"],
    editable: [],
    searchable: ["source_ip", "event_type", "country"],
    order: "created_at.desc",
    label: "Spam events",
  },
};

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/manager/resource")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const name = (params.get("resource") ?? "").trim();
        const resource = RESOURCES[name];
        if (!resource) {
          return Response.json(
            { error: "Unknown resource", available: Object.keys(RESOURCES) },
            { status: 400 },
          );
        }

        const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 200);
        const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
        const search = (params.get("search") ?? "").trim().slice(0, 120);

        // Section 5. Only a column this resource already returns may be sorted
        // on, so a crafted request cannot order by something the whitelist was
        // written to keep out of reach.
        // A screen sorts by the name it displays, which may be a renamed one.
        const askedSort = inward(resource, (params.get("sort") ?? "").trim());
        const sortable = resource.select.includes(askedSort) ? askedSort : null;
        const direction = params.get("dir") === "desc" ? "desc" : "asc";
        const order = sortable ? `${sortable}.${direction}` : resource.order;

        // Section 4. Same rule: a filter names a column the resource exposes,
        // an operator from a fixed list, and a value that is clipped. Anything
        // else is dropped rather than passed through to the database.
        const OPERATORS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is"]);
        const filters: string[] = [];
        for (const raw of params.getAll("filter")) {
          const [asked, operator, ...rest] = String(raw).split(".");
          const value = rest.join(".");
          const column = inward(resource, asked);
          if (!resource.select.includes(column)) continue;
          if (!OPERATORS.has(operator)) continue;
          if (!value || value.length > 200) continue;
          filters.push(`${column}=${operator}.${encodeURIComponent(value)}`);
        }

        let query =
          `${resource.table}?select=${resource.select.join(",")}` +
          `&order=${order}&limit=${limit}&offset=${offset}`;
        for (const clause of filters) query += `&${clause}`;
        if (search && resource.searchable.length) {
          const term = search.replace(/[(),*]/g, " ").trim();
          const or = resource.searchable.map((c) => `${c}.ilike.*${term}*`).join(",");
          query += `&or=(${encodeURIComponent(or)})`;
        }

        try {
          const response = await fetch(`${url()}/rest/v1/${query}`, {
            headers: { ...admin(), Prefer: "count=exact" },
          });
          if (!response.ok) {
            console.error("[manager] read failed", resource.table, response.status);
            return Response.json({ error: `Could not read ${resource.label}` }, { status: 502 });
          }
          const returned = (await response.json()) as Record<string, unknown>[];
          // Handed back under the names the screen renders, not the table's.
          const rows = returned.map((row) => toScreen(resource, row));
          const named = (list: string[]) => list.map((c) => outward(resource, c));
          const range = response.headers.get("content-range") ?? "";
          return Response.json({
            resource: name,
            label: resource.label,
            columns: named(resource.select),
            editable: named(resource.editable),
            // What the toolbar may offer, from the resource itself rather than
            // from a list the client keeps its own copy of.
            sortable: named(resource.select),
            sorted_by: outward(resource, sortable ?? resource.order.split(".")[0]),
            sort_direction: sortable ? direction : (resource.order.split(".")[1] ?? "asc"),
            filters_applied: filters.length,
            // What the console is allowed to offer. Without these it could
            // only ever edit rows that already existed, which is why two
            // home-page sections had no way to get their first row.
            creatable: named(resource.creatable ?? []),
            required: named(resource.required ?? []),
            retirable: Boolean(resource.archive),
            rows,
            total: Number(range.split("/")[1]) || (rows as unknown[]).length,
            limit,
            offset,
          });
        } catch (error) {
          console.error("[manager] read threw", error);
          return Response.json({ error: `Could not read ${resource.label}` }, { status: 502 });
        }
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { resource?: string; values?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const resource = RESOURCES[String(body.resource ?? "")];
        if (!resource) return Response.json({ error: "Unknown resource" }, { status: 400 });
        if (!resource.creatable?.length) {
          return Response.json(
            { error: `${resource.label} cannot be created here` },
            { status: 403 },
          );
        }

        // Only whitelisted columns survive, the same as a change.
        const values: Record<string, unknown> = {};
        for (const [sent, value] of Object.entries(body.values ?? {})) {
          // A new row arrives under the names the screen uses, the same as a
          // change does, and is translated before the whitelist sees it.
          const key = inward(resource, sent);
          if (!resource.creatable.includes(key)) continue;
          if (resource.arrays?.includes(key) && typeof value === "string") {
            const NEWLINE = String.fromCharCode(10);
            const pieces = value.includes(NEWLINE) ? value.split(NEWLINE) : value.split(",");
            values[key] = pieces.map((piece) => piece.trim()).filter(Boolean);
            continue;
          }
          values[key] = value;
        }

        const missing = (resource.required ?? []).filter(
          (column) => values[column] === undefined || values[column] === "",
        );
        if (missing.length) {
          return Response.json(
            {
              error: `Missing: ${missing.map((c) => outward(resource, c)).join(", ")}`,
              required: (resource.required ?? []).map((c) => outward(resource, c)),
            },
            { status: 400 },
          );
        }

        try {
          const response = await fetch(
            `${url()}/rest/v1/${resource.table}?select=${resource.select.join(",")}`,
            {
              method: "POST",
              headers: {
                ...admin(),
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify(values),
            },
          );
          if (!response.ok) {
            const detail = await response.text();
            console.error("[manager] create failed", resource.table, response.status, detail);
            return Response.json(
              { error: "That row was not created", detail: detail.slice(0, 200) },
              { status: 502 },
            );
          }
          const rows = (await response.json()) as Record<string, unknown>[];
          await recordAudit(request, {
            action: `${resource.label} created`,
            entityType: String(body.resource ?? ""),
            entityId: rows[0]?.id ? String(rows[0].id) : null,
            before: null,
            after: rows[0] ?? null,
            reason: "Row created from the Marketplace Manager.",
          });
          return Response.json({ ok: true, row: rows[0] ?? null });
        } catch (error) {
          console.error("[manager] create threw", error);
          return Response.json({ error: "That row was not created" }, { status: 502 });
        }
      },

      /**
       * Retire a row.
       *
       * Nothing in this catalogue is deleted. A row is taken out of use by the
       * change its resource names - hidden, archived, made inactive - so it is
       * still there to be put back.
       */
      DELETE: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const resource = RESOURCES[String(params.get("resource") ?? "")];
        const id = String(params.get("id") ?? "");
        if (!resource) return Response.json({ error: "Unknown resource" }, { status: 400 });
        if (!resource.archive) {
          return Response.json(
            { error: `${resource.label} cannot be retired here` },
            { status: 403 },
          );
        }
        if (!UUID.test(id))
          return Response.json({ error: "A row id is required" }, { status: 400 });

        try {
          const response = await fetch(
            `${url()}/rest/v1/${resource.table}?id=eq.${encodeURIComponent(id)}` +
              `&select=${resource.select.join(",")}`,
            {
              method: "PATCH",
              headers: {
                ...admin(),
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify(resource.archive),
            },
          );
          if (!response.ok) {
            console.error("[manager] retire failed", resource.table, response.status);
            return Response.json({ error: "That row was not retired" }, { status: 502 });
          }
          const rows = (await response.json()) as Record<string, unknown>[];
          await recordAudit(request, {
            action: `${resource.label} retired`,
            entityType: String(params.get("resource") ?? ""),
            entityId: id,
            before: null,
            after: rows[0] ?? null,
            reason: `Taken out of use from the Marketplace Manager: ${JSON.stringify(resource.archive)}`,
          });
          return Response.json({ ok: true, row: rows[0] ?? null, retired: resource.archive });
        } catch (error) {
          console.error("[manager] retire threw", error);
          return Response.json({ error: "That row was not retired" }, { status: 502 });
        }
      },

      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { resource?: string; id?: string; changes?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const resource = RESOURCES[String(body.resource ?? "")];
        if (!resource) return Response.json({ error: "Unknown resource" }, { status: 400 });
        if (!resource.editable.length) {
          return Response.json({ error: `${resource.label} is read only` }, { status: 403 });
        }
        const id = String(body.id ?? "");
        if (!UUID.test(id))
          return Response.json({ error: "A row id is required" }, { status: 400 });

        // Only whitelisted columns survive. Anything else is dropped, not an error,
        // so a UI sending an extra field cannot fail the whole save.
        const changes: Record<string, unknown> = {};
        for (const [sent, value] of Object.entries(body.changes ?? {})) {
          // Translated to the real column first, so the whitelist below is
          // still deciding about real columns and nothing else.
          const key = inward(resource, sent);
          if (!resource.editable.includes(key)) continue;
          // A list column arrives as the single line the table showed. One term
          // per line if the editor used lines, otherwise comma separated; empty
          // pieces are dropped so a stray separator cannot store a blank term.
          if (resource.arrays?.includes(key) && typeof value === "string") {
            const NEWLINE = String.fromCharCode(10);
            const pieces = value.includes(NEWLINE) ? value.split(NEWLINE) : value.split(",");
            changes[key] = pieces.map((piece) => piece.trim()).filter(Boolean);
            continue;
          }
          changes[key] = value;
        }
        if (!Object.keys(changes).length) {
          return Response.json(
            {
              error: "Nothing changeable was sent",
              editable: resource.editable.map((c) => outward(resource, c)),
            },
            { status: 400 },
          );
        }

        try {
          // Read before the change, so before_state is the row as it actually
          // was rather than a guess reconstructed from the request.
          let before: Record<string, unknown> | null = null;
          try {
            const prior = await fetch(
              `${url()}/rest/v1/${resource.table}?id=eq.${encodeURIComponent(id)}` +
                `&select=${resource.select.join(",")}&limit=1`,
              { headers: admin() },
            );
            if (prior.ok) before = ((await prior.json()) as Record<string, unknown>[])[0] ?? null;
          } catch {
            /* the change still proceeds; the audit simply has no before */
          }

          const response = await fetch(
            `${url()}/rest/v1/${resource.table}?id=eq.${encodeURIComponent(id)}` +
              `&select=${resource.select.join(",")}`,
            {
              method: "PATCH",
              headers: { ...admin(), Prefer: "return=representation" },
              body: JSON.stringify(changes),
            },
          );
          if (!response.ok) {
            const detail = await response.text();
            console.error("[manager] write failed", resource.table, response.status, detail);
            return Response.json({ error: "That change was not saved" }, { status: 502 });
          }
          const rows = (await response.json()) as Record<string, unknown>[];
          await recordAudit(request, {
            action: `${resource.label} updated`,
            entityType: String(body.resource ?? ""),
            entityId: id,
            before,
            after: rows[0] ?? null,
            reason: `Changed from the Marketplace Manager: ${Object.keys(changes).join(", ")}`,
          });
          return Response.json({
            ok: true,
            row: rows[0] ? toScreen(resource, rows[0]) : null,
            changed: Object.keys(changes).map((c) => outward(resource, c)),
          });
        } catch (error) {
          console.error("[manager] write threw", error);
          return Response.json({ error: "That change was not saved" }, { status: 502 });
        }
      },
    },
  },
});
