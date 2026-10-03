import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { STOREFRONT_TABLES, catalogueChanged } from "@/lib/marketplace/catalogue-invalidation";
import { readResourceRows, storeOwns } from "@/lib/seo/seo-store.server";

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
  /**
   * A filter always applied, in PostgREST's own syntax, so a resource can be a
   * scoped view of a table several managers share.
   *
   * partner_commissions holds every partner's commission - affiliate, author,
   * vendor, influencer - in one ledger on purpose. Influencer Manager must show
   * the influencer rows and must not be able to read or change another
   * partner's, so the scope is applied on the server rather than trusted to the
   * screen: it is appended to the read, and to the row a PATCH is allowed to
   * find, which means a crafted id outside the scope matches nothing.
   */
  scope?: string;
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
  /**
   * The only changes a screen may make to one state column: each target value
   * names the values it may be reached from. Any other target is refused, and
   * the write itself is conditional on the row still being in one of those
   * states, so a row that moved on in the meantime is not overwritten.
   */
  transitions?: { column: string; allowed: Record<string, string[]>; refused?: string };
  /**
   * Columns stamped with the time of a transition, by target value: a licence
   * that becomes revoked records when, so the screen cannot leave revoked_at
   * empty beside a revoked status.
   */
  stampOn?: Record<string, string[]>;
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

/**
 * system_settings rows that belong to a console of their own, each with its own
 * permission check and validation. Shown in the generic Settings and System
 * tables they could be rewritten around both - the permission matrix included.
 */
const RESERVED_SETTINGS =
  "key=not.in.(marketplace_role_permissions,marketplace_action_layer,marketplace_micro_interactions,marketplace_colour_palette)";

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

  /**
   * Someone opening a demo. The only engagement figure this module actually has.
   *
   * The studio's "Demo Engagement" card counted demo_url_audit_log entries with
   * the action `demo_url.test`, and no such action has ever been written - the
   * log holds demo_url.monitor, .sync, .investigate, .activate, .intake and
   * .create. So the card read zero whatever happened, and a health-check count
   * would not have been engagement anyway: that is the platform checking itself,
   * not a visitor opening anything.
   *
   * Read-only. Nothing here is an operator decision.
   */
  demo_clicks: {
    table: "demo_clicks",
    select: [
      "id",
      "demo_id",
      "product_id",
      "demo_url_id",
      "device_type",
      "browser",
      "country",
      "session_duration",
      "converted",
      "source_page",
      "clicked_at",
    ],
    editable: [],
    searchable: ["country", "device_type", "browser", "source_page"],
    order: "clicked_at.desc",
    retirable: false,
    label: "Demo open",
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
    // Status, plan and referral code have their own audited functions
    // (mm_reseller_status, mm_reseller_plan, mm_reseller_code_create), which
    // grant or withdraw the reseller role, switch referral links off, refuse a
    // self-action and notify the reseller. Written here they skipped all of it.
    editable: [
      "name",
      "email",
      "phone",
      "region",
      "tier",
      "kyc_status",
      "company_name",
      "legal_name",
      "gst_number",
      "pan_number",
      "notes",
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
  /**
   * The rest of the influencer programme.
   *
   * Influencer Manager's list sections rendered nothing at all - not an error,
   * an empty table - because a ManagerWall only reads a real table when its
   * config names a `resource`, and none of the influencer walls named one. They
   * fell back to `seed: []`. Only influencer_profiles had a resource here at
   * all, so the other seven tables had no way to reach a screen.
   *
   * Each is read-only except where an operator genuinely decides something: a
   * payout's status, an application's status, an account's verification. The
   * amounts, the handles and the follower counts are the record of what
   * happened and are not editable from a console.
   */
  influencer_applications: {
    table: "influencer_applications",
    select: [
      "id", "application_number", "full_name", "email", "phone", "country",
      "region", "niche", "followers", "engagement_rate", "status",
      "rejection_reason", "reviewed_at", "created_at",
    ],
    editable: ["status", "rejection_reason"],
    searchable: ["full_name", "email", "status", "application_number"],
    order: "created_at.desc",
    label: "Influencer application",
  },
  influencer_social_accounts: {
    table: "influencer_social_accounts",
    select: [
      "id", "profile_id", "platform", "handle", "profile_url", "followers",
      "engagement_rate", "verification_status", "verified_at",
    ],
    // Verifying an account is the operator's decision; the follower count is
    // the platform's own number and is not typed in here.
    editable: ["verification_status"],
    searchable: ["handle", "platform", "verification_status"],
    order: "verified_at.desc",
    label: "Influencer social account",
  },
  influencer_campaign_assignments: {
    table: "influencer_campaign_assignments",
    select: ["id", "profile_id", "campaign_id", "status", "assigned_at"],
    editable: ["status"],
    searchable: ["status"],
    order: "assigned_at.desc",
    label: "Campaign assignment",
  },
  influencer_earnings: {
    table: "influencer_earnings",
    select: [
      "id", "profile_id", "campaign_id", "gross_amount", "deductions",
      "net_amount", "currency", "status", "approved_at", "created_at",
    ],
    // Approving an earning is a decision; the amounts are not re-typed.
    editable: ["status"],
    searchable: ["status", "currency"],
    order: "created_at.desc",
    label: "Influencer earning",
  },
  influencer_payouts: {
    table: "influencer_payouts",
    select: [
      "id", "profile_id", "amount", "currency", "status",
      "provider_reference", "processed_at", "created_at",
    ],
    editable: ["status", "provider_reference"],
    searchable: ["status", "currency", "provider_reference"],
    order: "created_at.desc",
    label: "Influencer payout",
  },
  influencer_invoices: {
    table: "influencer_invoices",
    select: [
      "id", "invoice_number", "profile_id", "amount", "currency", "status",
      "issued_at", "due_at", "paid_at", "created_at",
    ],
    editable: ["status"],
    searchable: ["invoice_number", "status"],
    order: "created_at.desc",
    label: "Influencer invoice",
  },
  influencer_compensation_rules: {
    table: "influencer_compensation_rules",
    select: [
      "id", "campaign_id", "platform", "metric", "rate", "currency",
      "eligibility", "active", "created_at",
    ],
    editable: ["rate", "currency", "eligibility", "active"],
    searchable: ["platform", "metric"],
    order: "created_at.desc",
    label: "Compensation rule",
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
    // The keys with their own console stay with it (see RESERVED_SETTINGS), and
    // a key is not renamed from a table: renaming one silently resets whatever
    // read it back to its defaults.
    scope: RESERVED_SETTINGS,
    editable: ["label", "value", "value_type", "category", "description"],
    searchable: ["label", "category"],
    order: "id.asc",
    label: "System",
  },
  settings: {
    table: "system_settings",
    select: ["id", "key", "label", "value", "value_type", "category", "description", "updated_at"],
    scope: RESERVED_SETTINGS,
    editable: ["label", "value", "value_type", "category", "description"],
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
      // password_hash is not sent to a browser. It is a bcrypt hash written by
      // the demo password RPC; typing into it stored plain text and locked the
      // demo for every visitor.
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
  // The AMS tickets resellers have raised (a view over ams_tickets). Read only:
  // a ticket is worked in the AMS Manager, which owns its statuses and history.
  reseller_support_tickets: {
    table: "reseller_support_tickets",
    select: ["id", "ticket_no", "subject", "category", "priority", "status", "requester", "reseller", "assignee", "created_at", "updated_at"],
    editable: [],
    searchable: ["subject", "requester", "reseller", "ticket_no"],
    order: "created_at.desc",
    label: "Reseller support ticket",
  },
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
    // A retired rule stops applying to new orders. Commission already earned
    // keeps the rate recorded on it, so nothing is deleted.
    archive: { active: false },
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
    // A payout changes state only through mm_reseller_payout_status, which
    // requires a provider reference to pay and a reason to fail or reverse,
    // releases or settles the commission lines and writes the ledger. Setting
    // status here skipped every one of those.
    editable: ["payment_method"],
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
      "status",
      "membership_state",
      "order_id",
      "activated_at",
      "expires_at",
      "renewal_at",
      "created_at",
    ],
    // Read only. Entitlement (reseller_pricing_for) and the attention counts
    // read status and expires_at; a membership is opened, replaced and expired
    // by activate_reseller_membership, which also writes the entitlements, the
    // plan on the reseller and the event. Editing membership_state changed
    // nothing real, and editing status or the dates here would grant or end a
    // paid entitlement with none of that. There is no operator function to
    // pause or cancel one yet.
    editable: [],
    searchable: ["plan_code", "status", "membership_state"],
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
    // Read only. Nothing on the platform reads this table: a reseller is told
    // things through user_notifications (mm_notify), which only the database's
    // own functions may write. A broadcast saved or "published" here reached
    // nobody, so it is no longer accepted.
    editable: [],
    searchable: ["title", "body", "audience"],
    order: "created_at.desc",
    retirable: false,
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
      // When the product was added: Product Manager's list and its
      // "recent" panel print and sort by it, and it was never selected.
      "created_at",
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
      // Product Manager's Add Product form offers features; the storefront
      // already reads the column.
      "features",
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
      // The keyword blueprint itself. It has been stored on all 7,280 slots
      // since the slots were built and no screen has ever read it, which is
      // why the SEO Manager showed nothing about the cards it owns.
      "keyword_set",
      "faq_set",
      "schema_types",
      "search_engines",
      "business_type",
      "software_type",
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
  // The translated strings themselves: 117,013 of them across 140 languages.
  // Every localized title, description and heading a search engine is shown
  // comes from here, and no screen could reach it.
  translations: {
    table: "marketplace_translations",
    select: [
      "id",
      "target_language",
      "namespace",
      "translation_key",
      "source_text",
      "translated_text",
      "status",
      "quality_score",
      "engine",
      "version",
      "reviewed_by",
      "reviewed_at",
      "updated_at",
    ],
    editable: [],
    searchable: ["target_language", "namespace", "translation_key", "status", "engine"],
    order: "updated_at.desc",
    label: "Translations",
  },
  // Each time a translation changed, and what it changed to. This is the
  // change history section 19 asks for, for the localized half of the site.
  translation_revisions: {
    table: "i18n_translation_revisions",
    select: [
      "id",
      "translation_id",
      "version",
      "translated_text",
      "status",
      "quality_score",
      "engine",
      "engine_version",
      "changed_by",
      "changed_at",
    ],
    editable: [],
    searchable: ["status", "engine", "changed_by"],
    order: "changed_at.desc",
    label: "Translation revisions",
  },
  // Terms that must always translate the same way - brand names, product
  // names, the words a catalogue cannot afford to have rendered differently on
  // two pages.
  glossary: {
    table: "i18n_glossary_terms",
    select: [
      "id",
      "source_language",
      "target_language",
      "source_term",
      "target_term",
      "rule",
      "namespace",
      "status",
      "approved_by",
      "approved_at",
      "updated_at",
    ],
    editable: ["target_term", "rule", "status", "notes"],
    searchable: ["source_term", "target_term", "target_language", "status"],
    order: "source_term.asc",
    label: "Glossary",
  },
  // The marketing team's own keyword list, kept separately from seo_keywords.
  marketing_keywords: {
    table: "marketing_seo_keywords",
    select: [
      "id",
      "keyword",
      "page_url",
      "position",
      "previous_position",
      "search_volume",
      "difficulty",
      "cpc",
      "intent",
      "country",
      "status",
      "is_seed",
      "updated_at",
    ],
    editable: ["status", "intent"],
    searchable: ["keyword", "page_url", "country", "intent", "status"],
    order: "updated_at.desc",
    label: "Marketing keywords",
  },
  // What actually broke, where. An SEO console that cannot see the errors the
  // site is throwing is reporting on a site it cannot see.
  seo_errors: {
    table: "seo_error_events",
    select: [
      "id",
      "source",
      "name",
      "message",
      "route",
      "fn_name",
      "severity",
      "occurrences",
      "resolved",
      "first_seen_at",
      "last_seen_at",
    ],
    editable: ["resolved"],
    searchable: ["source", "name", "message", "route", "severity"],
    order: "last_seen_at.desc",
    label: "SEO errors",
  },
  // How long the SEO machinery takes to answer. Section 15 asks for
  // performance as part of a page's score; this is where the measurements are.
  benchmarks: {
    table: "seo_benchmark_runs",
    select: [
      "id",
      "label",
      "target",
      "ttfb_ms",
      "query_ms",
      "pagination_ms",
      "report_ms",
      "rows_scanned",
      "status",
      "created_at",
    ],
    editable: [],
    searchable: ["label", "target", "status"],
    order: "created_at.desc",
    label: "Benchmarks",
  },
  // The language engine, which the SEO Manager could not see at all.
  //
  // 145 languages are registered and 140 are enabled; 128 of them carry
  // machine translation only. Every one of them is an hreflang target and a
  // localized URL, so the state of this table is the state of the site's
  // international SEO - and no screen in the SEO console read a row of it.
  //
  // Read-only here. Which languages a site serves, and whether a translation
  // is machine or reviewed, is decided by the translation engine and its
  // reviewers; an operator flipping a status by hand would tell the SEO
  // console something the rest of the platform does not believe.
  i18n_languages: {
    table: "i18n_languages",
    select: [
      "code",
      "name",
      "native_name",
      "locale",
      "script",
      "direction",
      "region",
      "enabled",
      "translation_status",
      "fallback",
      "sort_order",
      "updated_at",
    ],
    editable: [],
    searchable: ["code", "name", "native_name", "region", "translation_status"],
    order: "sort_order.asc",
    label: "Languages",
  },
  // The translation queue. 105,617 done and 94,613 still waiting, which is the
  // single largest fact about this site's international SEO and was nowhere on
  // any screen.
  i18n_jobs: {
    table: "i18n_translation_jobs",
    select: [
      "id",
      "target_language",
      "namespace",
      "status",
      "result_status",
      "quality_score",
      "attempts",
      "priority",
      "last_error",
      "created_at",
      "finished_at",
    ],
    editable: [],
    searchable: ["target_language", "namespace", "status", "result_status"],
    order: "created_at.desc",
    label: "Translation jobs",
  },
  // IndexNow: what was actually submitted to the search engines that accept it,
  // and what they answered.
  indexnow: {
    table: "indexnow_submissions",
    select: [
      "id",
      "submission_id",
      "host",
      "url_count",
      "status",
      "response_status",
      "created_at",
    ],
    editable: [],
    searchable: ["host", "status", "submission_id"],
    order: "created_at.desc",
    label: "IndexNow submissions",
  },
  // The entity graph: every thing the SEO system reasons about, each traceable
  // to the row that produced it.
  seo_entities: {
    table: "seo_entities",
    select: ["id", "kind", "key", "label", "url", "source_table", "status", "updated_at"],
    editable: [],
    searchable: ["kind", "key", "label", "url"],
    order: "kind.asc",
    label: "SEO entities",
  },
  // The relationships between them. Every edge names the column that proved
  // it; the table will not accept one without.
  seo_edges: {
    table: "seo_entity_edges",
    select: ["id", "relationship", "evidence", "confidence", "status", "created_at"],
    editable: [],
    searchable: ["relationship", "evidence"],
    order: "relationship.asc",
    label: "Entity relationships",
  },
  // Proposed internal links. Nothing here has edited a page: each one is an
  // argument with a reason attached, waiting to be accepted or refused.
  seo_links: {
    table: "seo_link_recommendations",
    select: [
      "id",
      "source_url",
      "target_url",
      "relationship",
      "anchor",
      "reason",
      "priority",
      "state",
      "qa_findings",
      "generated_at",
    ],
    editable: ["state"],
    searchable: ["source_url", "target_url", "relationship", "state"],
    order: "priority.asc",
    label: "Internal link recommendations",
  },
  // Things worth doing, each carrying the figures it was derived from.
  seo_opportunities: {
    table: "seo_opportunities",
    select: [
      "id",
      "kind",
      "entity_kind",
      "entity_key",
      "target_url",
      "evidence",
      "source",
      "severity",
      "impact",
      "confidence",
      "recommended_action",
      "status",
      "detected_at",
    ],
    editable: ["status"],
    searchable: ["kind", "target_url", "entity_key", "severity", "status", "source"],
    order: "detected_at.desc",
    label: "SEO opportunities",
  },
  // Every proposed change to SEO data: what it was, what it would become, who
  // asked, who approved, and how to put it back. Section 19 exists because an
  // AI suggestion that rewrites one card slot's keywords is one request away
  // from rewriting all 7,280, and "undo" has to be a stored value.
  //
  // The state is editable so an operator can approve or reject from the
  // console. The values are not: what a change would do is decided when it is
  // proposed, and editing it afterwards would make the approval meaningless.
  seo_changes: {
    table: "seo_change_requests",
    select: [
      "id",
      "entity_type",
      "target_url",
      "field",
      "old_value",
      "new_value",
      "reason",
      "source",
      "provider",
      "model",
      "state",
      "impact",
      "qa_findings",
      "approved_at",
      "published_at",
      "rolled_back_at",
      "rollback_of",
      "created_at",
    ],
    editable: ["state"],
    searchable: ["target_url", "field", "state", "source", "entity_type"],
    order: "created_at.desc",
    label: "SEO change requests",
  },
  // The indexing gate's own verdicts: one row per page the site can serve,
  // saying whether it may be indexed, whether it may go in a sitemap, and -
  // when it may not - the reason. Fourteen thousand eight hundred of them,
  // and until now no screen in the SEO Manager read a single one, so the
  // decision that governs every page on the site was invisible to the people
  // who own it.
  //
  // Read-only on purpose. A verdict is produced by the gate from evidence it
  // recorded; an operator who could edit it by hand could mark a thin page
  // indexable and the gate would have no way of knowing, which is the one
  // thing this table exists to prevent.
  seo_gate: {
    table: "seo_indexing_decisions",
    select: [
      "id",
      "url",
      "entity_type",
      "state",
      "indexable",
      "sitemap_eligible",
      "quality_status",
      "quality_score",
      "fingerprint_class",
      "canonical_status",
      "schema_status",
      "hreflang_status",
      "content_status",
      "http_status",
      "blocking_reason",
      "duplicate_of",
      "evaluated_at",
    ],
    editable: [],
    searchable: ["url", "state", "entity_type", "blocking_reason"],
    order: "evaluated_at.desc",
    label: "Indexing gate",
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
    // Cancelling is for an order that was never paid. A paid order is ended by
    // a refund (marketplace_order_refunds), which settles the money, revokes the
    // licence and reverses the commission together; setting it to cancelled
    // here did none of that. Reinstating returns a cancelled order to awaiting
    // payment, the one state marketplace_order_status_guard lets it go back to.
    transitions: {
      column: "status",
      allowed: { cancelled: ["pending_payment"], pending_payment: ["cancelled"] },
      refused: "A paid order is ended by a refund, not cancelled.",
    },
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
    // A licence is revoked by hand, never reinstated by hand: a licence the
    // refund settlement revoked came back to life when set to active here.
    transitions: {
      column: "status",
      allowed: { revoked: ["active"] },
      refused: "A revoked or expired licence is reissued through a new order, not reactivated.",
    },
    stampOn: { revoked: ["revoked_at"] },
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
    // processed fires marketplace_refund_settle - the order is refunded, its
    // licences revoked and commissions reversed - so it is reached only when
    // the provider confirms the money went back, never typed in here.
    transitions: {
      column: "status",
      allowed: { approved: ["pending"], cancelled: ["pending", "approved"] },
      refused: "A refund becomes processed or failed from the payment provider's answer.",
    },
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
    // An operator approves or rejects a pending commission. Paid comes from a
    // payout, and a reversal is a second row (partner_earnings migration), so
    // neither is set by hand.
    transitions: {
      column: "status",
      allowed: { approved: ["pending"], rejected: ["pending"] },
      refused: "Paid is set by the payout and a reversal is recorded as its own row.",
    },
    stampOn: { approved: ["approved_at"] },
    // partner_kind is an enum and cannot be searched with ilike - the read
    // failed with 502 for every search term.
    searchable: ["status", "currency"],
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
    // requested -> approved -> processing -> completed, or failed / cancelled
    // on the way. Nothing goes backwards, and completed is not reached in one
    // jump from a request.
    transitions: {
      column: "status",
      allowed: {
        approved: ["requested"],
        processing: ["approved"],
        completed: ["processing"],
        failed: ["approved", "processing"],
        cancelled: ["requested", "approved"],
      },
      refused: "A payout moves requested, approved, processing, completed.",
    },
    stampOn: { approved: ["approved_at"], completed: ["completed_at"] },
    searchable: ["status", "provider_reference"],
    order: "requested_at.desc",
    retirable: false,
    label: "Partner payouts",
  },

  /**
   * What each influencer tier pays and what it takes to reach it.
   *
   * "Tiers & Levels" has been in the Influencer Manager navigation since it was
   * built with nothing behind it. Every figure is editable here, which is the
   * point: a commission rate is the owner's decision, so it lives in a row he
   * can change rather than in code. A fourth tier can be added from this screen
   * without a deployment.
   */
  influencer_tiers: {
    table: "influencer_tiers",
    select: [
      "id",
      "code",
      "name",
      "commission_percent",
      "min_verified_followers",
      "min_sales_90d",
      "min_revenue_180d",
      "hold_days",
      "payout_floor",
      "currency",
      "recommended",
      "enabled",
      "sort_order",
      "created_at",
    ],
    editable: [
      "name",
      "commission_percent",
      "min_verified_followers",
      "min_sales_90d",
      "min_revenue_180d",
      "hold_days",
      "payout_floor",
      "currency",
      "recommended",
      "enabled",
      "sort_order",
    ],
    creatable: ["code", "name", "commission_percent", "min_verified_followers", "min_sales_90d", "min_revenue_180d", "hold_days", "payout_floor", "currency", "sort_order"],
    required: ["code", "name", "commission_percent"],
    searchable: ["code", "name"],
    order: "sort_order.asc",
    retirable: false,
    label: "Influencer tier",
  },

  /**
   * The same ledger, scoped to influencers, for Influencer Manager.
   *
   * An influencer's commission on a marketplace sale belongs in
   * partner_commissions - the ledger the platform already keeps for every
   * partner kind, with the idempotency key, the attribution and the rule
   * snapshot on each row - not in a fourth table beside it. influencer_earnings
   * stays what it has always been: what a campaign's activity paid, per click or
   * view under a compensation rule. They are two different ways the same person
   * earns and both are shown.
   */
  influencer_order_commissions: {
    table: "partner_commissions",
    scope: "partner_kind=eq.influencer",
    select: [
      "id",
      "partner_id",
      "order_id",
      "order_item_id",
      "gross_amount",
      "commission_amount",
      "currency",
      "status",
      "reversal_reason",
      "payout_id",
      "earned_at",
      "approved_at",
    ],
    // An operator decides whether a commission stands. The amounts are what the
    // sale produced and are not editable by hand.
    editable: ["status"],
    searchable: ["status", "currency"],
    order: "earned_at.desc",
    retirable: false,
    label: "Influencer order commission",
  },

  influencer_order_payouts: {
    table: "partner_payouts",
    scope: "partner_kind=eq.influencer",
    select: [
      "id",
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
    searchable: ["status", "provider_reference"],
    order: "requested_at.desc",
    retirable: false,
    label: "Influencer payout",
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
    // Only a failed message is queued again. Setting a sent one back to
    // pending sent the customer the same e-mail a second time.
    transitions: {
      column: "status",
      allowed: { pending: ["failed"] },
      refused: "Only a failed message can be sent again.",
    },
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
  // The safety gate's own record. Read-only here on purpose: an indexing
  // decision is the output of an audit, and letting an operator type over it
  // would let a page into the sitemap that nothing had actually checked. To
  // change a verdict, fix the page and run the gate again.
  seo_indexing_decisions: {
    table: "seo_indexing_decisions",
    select: [
      "id",
      "url",
      "entity_type",
      "state",
      "indexable",
      "sitemap_eligible",
      "quality_status",
      "quality_score",
      "fingerprint_class",
      "canonical_status",
      "schema_status",
      "hreflang_status",
      "content_status",
      "http_status",
      "blocking_reason",
      "duplicate_of",
      "audit_version",
      "evaluated_at",
    ],
    editable: [],
    searchable: ["url", "state", "entity_type", "fingerprint_class", "quality_status"],
    order: "evaluated_at.desc",
    label: "Indexing decisions",
  },
  // What each page's content actually is, layer by layer. body_masked is the
  // one that answers "is this the neighbouring page with the country swapped".
  seo_fingerprints: {
    table: "seo_fingerprints",
    select: [
      "id",
      "url",
      "entity_type",
      "layer",
      "algorithm",
      "hash",
      "simhash",
      "token_count",
      "sample",
      "audit_version",
      "computed_at",
    ],
    editable: [],
    searchable: ["url", "layer", "hash", "entity_type"],
    order: "computed_at.desc",
    label: "Content fingerprints",
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
        const primary = sortable ? `${sortable}.${direction}` : resource.order;
        // A unique last key, so a page boundary falls in the same place every
        // time. sort_order is shared by many rows; ordered by it alone, paging
        // repeated some rows and never showed others.
        const order =
          resource.select.includes("id") && !/(^|,)id\./.test(primary) ? `${primary},id.asc` : primary;

        // Section 4. Same rule: a filter names a column the resource exposes,
        // an operator from a fixed list, and a value that is clipped. Anything
        // else is dropped rather than passed through to the database.
        const OPERATORS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is"]);
        const filters: string[] = [];
        // The same filters, kept as their parts as well as as a query string.
        // Two of the tables this handler exposes no longer live in Supabase, and
        // for those the clause has to be built as SQL instead of as PostgREST.
        const parsedFilters: { column: string; operator: string; value: string }[] = [];
        for (const raw of params.getAll("filter")) {
          const [asked, first, ...tail] = String(raw).split(".");
          // "column.not.is.null" is the one negated form the screens send. It
          // used to parse as operator "not", be dropped, and leave the count
          // unfiltered - so "with a keyword" showed every row.
          const negated = first === "not" && tail[0] === "is";
          const operator = negated ? "not.is" : first;
          const rest = negated ? tail.slice(1) : tail;
          const value = rest.join(".");
          if (negated) {
            const column = inward(resource, asked);
            if (!resource.select.includes(column)) continue;
            if (!["null", "true", "false"].includes(value)) continue;
            filters.push(`${column}=not.is.${value}`);
            parsedFilters.push({ column, operator, value });
            continue;
          }
          const column = inward(resource, asked);
          if (!resource.select.includes(column)) continue;
          if (!OPERATORS.has(operator)) continue;
          if (!value || value.length > 200) continue;
          filters.push(`${column}=${operator}.${encodeURIComponent(value)}`);
          parsedFilters.push({ column, operator, value });
        }

        let query =
          `${resource.table}?select=${resource.select.join(",")}` +
          `&order=${order}&limit=${limit}&offset=${offset}`;
        // A scoped resource can never be widened by anything the caller sends.
        if (resource.scope) query += `&${resource.scope}`;
        for (const clause of filters) query += `&${clause}`;
        if (search && resource.searchable.length) {
          const term = search.replace(/[(),*]/g, " ").trim();
          const or = resource.searchable.map((c) => `${c}.ilike.*${term}*`).join(",");
          query += `&or=(${encodeURIComponent(or)})`;
        }

        try {
          let returned: Record<string, unknown>[];
          let total: number;

          if (storeOwns(resource.table)) {
            // The SEO gate's two tables answer from our own PostgreSQL. Same
            // columns, same order, same filters, same page - read from the
            // database they are now in, so this screen keeps working.
            const page = await readResourceRows({
              table: resource.table,
              select: resource.select,
              order,
              limit,
              offset,
              filters: parsedFilters,
              search,
              searchable: resource.searchable,
            });
            returned = page.rows;
            total = page.total;
          } else {
            const response = await fetch(`${url()}/rest/v1/${query}`, {
              headers: { ...admin(), Prefer: "count=exact" },
            });
            if (!response.ok) {
              console.error("[manager] read failed", resource.table, response.status);
              return Response.json({ error: `Could not read ${resource.label}` }, { status: 502 });
            }
            returned = (await response.json()) as Record<string, unknown>[];
            const range = response.headers.get("content-range") ?? "";
            total = Number(range.split("/")[1]) || 0;
          }

          // Handed back under the names the screen renders, not the table's.
          const rows = returned.map((row) => toScreen(resource, row));
          const named = (list: string[]) => list.map((c) => outward(resource, c));
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
            total: total || (rows as unknown[]).length,
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
          // The storefront caches what this table holds; empty them so the saved
          // change is what the next visitor sees (catalogue-invalidation.ts).
          if (STOREFRONT_TABLES.has(resource.table)) catalogueChanged();
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
            `${url()}/rest/v1/${resource.table}?id=eq.${encodeURIComponent(id)}${resource.scope ? `&${resource.scope}` : ""}` +
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
          if (!rows.length) {
            return Response.json(
              { error: `${resource.label}: that row is no longer here, so nothing was retired.` },
              { status: 404 },
            );
          }
          // The storefront caches what this table holds; empty them so the saved
          // change is what the next visitor sees (catalogue-invalidation.ts).
          if (STOREFRONT_TABLES.has(resource.table)) catalogueChanged();
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

        // A state column with named transitions only moves along them.
        let fromFilter = "";
        const rule = resource.transitions;
        if (rule && rule.column in changes) {
          const to = String(changes[rule.column] ?? "");
          const from = rule.allowed[to];
          if (!from) {
            return Response.json(
              {
                error:
                  `${resource.label}: ${to || "that"} cannot be set here.` +
                  (rule.refused ? ` ${rule.refused}` : ""),
              },
              { status: 403 },
            );
          }
          fromFilter = `&${rule.column}=in.(${from.map(encodeURIComponent).join(",")})`;
          const now = new Date().toISOString();
          for (const column of resource.stampOn?.[to] ?? []) changes[column] = now;
        }

        try {
          // Read before the change, so before_state is the row as it actually
          // was rather than a guess reconstructed from the request.
          let before: Record<string, unknown> | null = null;
          try {
            const prior = await fetch(
              `${url()}/rest/v1/${resource.table}?id=eq.${encodeURIComponent(id)}${resource.scope ? `&${resource.scope}` : ""}` +
                `&select=${resource.select.join(",")}&limit=1`,
              { headers: admin() },
            );
            if (prior.ok) before = ((await prior.json()) as Record<string, unknown>[])[0] ?? null;
          } catch {
            /* the change still proceeds; the audit simply has no before */
          }

          const response = await fetch(
            `${url()}/rest/v1/${resource.table}?id=eq.${encodeURIComponent(id)}${resource.scope ? `&${resource.scope}` : ""}` +
              `${fromFilter}&select=${resource.select.join(",")}`,
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
          // Nothing matched: the row was removed or moved out of this screen's
          // scope since it was loaded. Answering ok with row:null blanked the
          // table, which then crashed reading the id of a row that was not there.
          if (!rows.length && !(rule && fromFilter)) {
            return Response.json(
              { error: `${resource.label}: that row is no longer here. Refresh and try again.` },
              { status: 404 },
            );
          }
          // The write was conditional on the state it may come from. Nothing
          // matched, so the row is not (or is no longer) in one of them.
          if (rule && fromFilter && !rows.length) {
            const was = before ? String(before[rule.column] ?? "") : "";
            return Response.json(
              {
                error:
                  `${resource.label}: this row is ${was || "not in a state that allows this"}, ` +
                  `so it cannot become ${String(changes[rule.column])}.` +
                  (rule.refused ? ` ${rule.refused}` : ""),
              },
              { status: 409 },
            );
          }
          // The storefront caches what this table holds; empty them so the saved
          // change is what the next visitor sees (catalogue-invalidation.ts).
          if (STOREFRONT_TABLES.has(resource.table)) catalogueChanged();
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
