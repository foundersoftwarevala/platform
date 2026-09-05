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
};
