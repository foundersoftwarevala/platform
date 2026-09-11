import type { ComponentType } from "react";
import { LiveTable } from "./LiveTable";

/**
 * Live data in front of the designed sections.
 *
 * An audit found 69 of the Marketplace Manager's 78 sections drawing hardcoded
 * arrays, so an operator working there changed nothing on the storefront. Each
 * section listed here now opens with the real marketplace rows, editable in
 * place, above whatever it already showed.
 *
 * Nothing is replaced. `withLive` renders the live table and then the original
 * section exactly as it was, so every screen keeps its existing content and
 * gains a control that works.
 */

type SectionProps = { onNavigate?: (id: string) => void };

export function withLive(
  resource: string,
  columns: string[],
  Original: ComponentType<SectionProps>,
): ComponentType<SectionProps> {
  const Wrapped = (props: SectionProps) => (
    <>
      <div className="px-4 pt-6 md:px-8">
        <LiveTable resource={resource} columns={columns} />
      </div>
      <Original {...props} />
    </>
  );
  Wrapped.displayName = `Live(${resource})`;
  return Wrapped;
}

/** Which real table each section governs, and the columns worth leading with. */
export const LIVE_SECTIONS: Record<string, { resource: string; columns: string[] }> = {
  Products: { resource: "products", columns: ["name", "industry_label", "price_label", "visible", "is_featured", "content_status"] },
  Categories: { resource: "categories", columns: ["name", "slug", "sort_order", "is_hidden", "is_featured"] },
  Cards: { resource: "products", columns: ["name", "badge", "is_featured", "is_trending", "is_best_seller", "is_new_release"] },
  "Card Manager": { resource: "products", columns: ["name", "badge", "price_label", "rating", "downloads_label", "visible"] },
  "Product Content": { resource: "products", columns: ["name", "industry_label", "content_status", "visible"] },
  "Product Media": { resource: "products", columns: ["name", "slug", "content_status", "visible"] },
  "Product URLs": { resource: "products", columns: ["name", "slug", "demo_url", "content_status"] },
  "Product Analytics": { resource: "products", columns: ["name", "rating", "downloads_label", "is_trending", "is_best_seller"] },
  "Demo System": { resource: "products", columns: ["name", "slug", "demo_url", "visible", "content_status"] },
  Pricing: { resource: "products", columns: ["name", "price_label", "industry_label", "visible"] },
  Moderation: { resource: "products", columns: ["name", "content_status", "visible", "updated_at"] },
  "Author Approval": { resource: "products", columns: ["name", "content_status", "visible"] },

  Orders: { resource: "orders", columns: ["order_no", "status", "total", "currency", "txnid", "payment_gateway", "created_at"] },
  Payments: { resource: "payments", columns: ["event_type", "provider", "signature_valid", "order_id", "created_at"] },
  License: { resource: "licences", columns: ["license_key", "status", "issued_at", "activation_count", "revoked_reason"] },
  Customers: { resource: "leads", columns: ["name", "email", "phone", "status", "source", "created_at"] },
  Leads: { resource: "leads", columns: ["name", "email", "phone", "status", "source_page", "cta_action", "created_at"] },

  Search: { resource: "keywords", columns: ["keyword", "country", "industry", "intent", "status", "position"] },
  "SEO Automation": { resource: "keywords", columns: ["keyword", "target_url", "country", "status"] },
  Notifications: { resource: "mail", columns: ["to_email", "subject", "status", "attempts", "last_error", "created_at"] },

  // Sections that had no data behind them at all until now. Each one
  // opens with the rows of the table it governs, editable in place where
  // the server allows it, above the screen it already had.
  "Vendors": { resource: "vendors", columns: ["slug", "name", "country", "verified", "rating", "product_count"] },
  "Authors": { resource: "authors", columns: ["slug", "status", "display_name", "seller_kind", "owner_user_id", "payout_currency"] },
  "Resellers": { resource: "resellers", columns: ["name", "code", "email", "status", "phone", "region"] },
  "Affiliate": { resource: "affiliate", columns: ["status", "display_name", "user_id", "created_at", "updated_at"] },
  "Influencer": { resource: "influencer", columns: ["email", "status", "full_name", "country", "region", "niche"] },
  "Offers": { resource: "offers", columns: ["title", "discount_percent", "code", "start_date", "end_date", "status"] },
  "Popups": { resource: "popups", columns: ["name", "label", "key", "element_type", "enabled", "desktop_enabled"] },
  "Walls": { resource: "walls", columns: ["status", "title", "source_mode", "max_products", "auto_rule", "allow_cross_category"] },
  "Partners": { resource: "partners", columns: ["status", "display_name", "user_id", "created_at", "updated_at"] },
  "Blog": { resource: "blog", columns: ["title", "status", "url", "content_type", "target_keyword", "body"] },
  "Media Library": { resource: "media_library", columns: ["name", "key", "asset_type", "public_path", "mime_type", "width"] },
  "Reports": { resource: "reports", columns: ["name", "status", "report_type", "period_start", "period_end", "summary"] },
  "Downloads": { resource: "downloads", columns: ["entitlement_id", "buyer_id", "version_id", "created_at"] },
  "Security": { resource: "security", columns: ["category", "title", "job_id", "asset_id", "result", "severity"] },
  "Upload Scanner": { resource: "upload_scanner", columns: ["status", "asset_id", "stages", "scanner_version", "provider", "provider_reference"] },
  "Brand Protect": { resource: "brand_protect", columns: ["status", "case_no", "rule_key", "surface", "asset_reference", "classification"] },
  "Audit & History": { resource: "audit_history", columns: ["reason", "actor_id", "action", "entity_type", "entity_id", "metadata"] },
  "AI Providers": { resource: "ai_providers", columns: ["name", "slug", "category", "status", "base_url", "region"] },
  "Integrations": { resource: "integrations", columns: ["name", "category", "status", "direction", "auth_type", "webhook_url"] },
  "Automation": { resource: "automation", columns: ["name", "trigger_type", "condition", "action_type", "action_config", "enabled"] },
  "System": { resource: "system", columns: ["label", "category", "key", "value", "value_type", "description"] },
  "Settings": { resource: "settings", columns: ["label", "category", "key", "value", "value_type", "description"] },
  "Support": { resource: "support", columns: ["subject", "category", "status", "reference", "description", "customer_name"] },
  "Demo Domain": { resource: "demo_domain", columns: ["slug", "status", "demo_ref", "hostname", "environment", "pattern"] },
  "Demo Sandbox": { resource: "demo_sandbox", columns: ["status", "sandbox_ref", "failure_reason", "isolation_strategy", "baseline_version", "cleanup_status"] },
  "QR System": { resource: "qr_system", columns: ["qr_code", "target_url", "foreground", "background", "size", "error_correction"] },
  "Contact": { resource: "contact", columns: ["name", "email", "company", "category", "phone", "industry"] },
  "AI Content": { resource: "ai_content", columns: ["status", "content_type", "language", "content", "content_json", "ai_original"] },
  "Analytics": { resource: "analytics", columns: ["event_type", "user_id", "payload", "created_at"] },
  "Quality Gate": { resource: "quality_gate", columns: ["recovery_days", "dual_approval", "auto_purge", "preserve_orders", "preserve_licenses", "preserve_reviews"] },
};
