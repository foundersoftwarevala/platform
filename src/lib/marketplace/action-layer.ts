/**
 * The Action Layer: one place that decides which product actions exist.
 *
 * Ten actions were listed on the Product Action Manager with a switch beside
 * each, every switch hardcoded on and none of them wired to anything. Turning
 * Buy Now off changed nothing anywhere, because each surface decided for
 * itself what to render.
 *
 * The registry lives in `system_settings` under one key rather than in new
 * tables. marketplace_action_registry, _configs, _overrides and _events all
 * answer 404 and this project has no way to run DDL today; section 43 asks for
 * new tables only where they are missing, and section 42 asks not to duplicate
 * what exists. system_settings is the platform's own configuration store, so
 * that is where this goes.
 *
 * The resolver is the point of the module. Every surface asks it the same
 * question and gets the same answer, including the reason an action is not
 * available - because an action that cannot execute should not be rendered as
 * though it can.
 */

export type ActionKey =
  | "VIEW_DETAILS" | "BUY_NOW" | "ADD_TO_CART" | "WISHLIST" | "COMPARE"
  | "SHARE" | "NOTIFY_ME" | "REQUEST_DEMO" | "LIVE_DEMO" | "REVIEWS";

export type Visibility = "VISIBLE" | "DISABLED" | "HIDDEN" | "CONDITIONAL";

export type ActionConfig = {
  key: ActionKey;
  label: string;
  enabled: boolean;
  visibility: Visibility;
  sort_order: number;
  /** Who may perform it. Enforced server side; this only decides rendering. */
  permission: "public" | "authenticated" | "purchaser" | "operator";
  variant: "primary" | "ghost" | "outline";
};

/** What the registry looks like before anybody has configured it. */
export const DEFAULT_ACTIONS: ActionConfig[] = [
  { key: "VIEW_DETAILS", label: "View Details", enabled: true, visibility: "VISIBLE", sort_order: 1, permission: "public", variant: "outline" },
  { key: "LIVE_DEMO", label: "Live Demo", enabled: true, visibility: "CONDITIONAL", sort_order: 2, permission: "public", variant: "primary" },
  { key: "REQUEST_DEMO", label: "Request Demo", enabled: true, visibility: "VISIBLE", sort_order: 3, permission: "public", variant: "primary" },
  { key: "BUY_NOW", label: "Buy Now", enabled: true, visibility: "CONDITIONAL", sort_order: 4, permission: "authenticated", variant: "primary" },
  { key: "ADD_TO_CART", label: "Add to Cart", enabled: true, visibility: "CONDITIONAL", sort_order: 5, permission: "authenticated", variant: "outline" },
  { key: "WISHLIST", label: "Wishlist", enabled: true, visibility: "VISIBLE", sort_order: 6, permission: "public", variant: "ghost" },
  { key: "SHARE", label: "Share", enabled: true, visibility: "VISIBLE", sort_order: 7, permission: "public", variant: "ghost" },
  { key: "COMPARE", label: "Compare", enabled: false, visibility: "HIDDEN", sort_order: 8, permission: "public", variant: "ghost" },
  { key: "NOTIFY_ME", label: "Notify Me", enabled: false, visibility: "CONDITIONAL", sort_order: 9, permission: "authenticated", variant: "ghost" },
  { key: "REVIEWS", label: "Reviews", enabled: true, visibility: "VISIBLE", sort_order: 10, permission: "public", variant: "ghost" },
];

export const REGISTRY_KEY = "marketplace_action_layer";

export type ProductContext = {
  id?: string | null;
  slug?: string | null;
  demo_url?: string | null;
  visible?: boolean | null;
  price_label?: string | null;
  content_status?: string | null;
};

export type Environment = {
  /** Whether a payment provider actually authenticates. */
  paymentConfigured: boolean;
  /** Whether the viewer is signed in. */
  signedIn: boolean;
};

export type ResolvedAction = ActionConfig & {
  available: boolean;
  /** Why not, in words an operator can act on. Null when it is available. */
  reason: string | null;
  href?: string;
};

/**
 * The one answer every surface uses.
 *
 * An action is available only when the registry enables it, its condition is
 * met, and the thing it needs actually exists. Buy Now with no payment
 * provider is reported unavailable with that reason rather than rendered and
 * left to fail on click.
 */
export function resolveProductActions(
  actions: ActionConfig[],
  product: ProductContext,
  env: Environment,
): ResolvedAction[] {
  const purchasable =
    product.visible !== false &&
    Boolean(product.price_label) &&
    product.content_status !== "archived";

  return [...actions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a): ResolvedAction => {
      const off = (reason: string): ResolvedAction => ({ ...a, available: false, reason });

      if (!a.enabled) return off("Turned off in the Action Layer.");
      if (a.visibility === "HIDDEN") return off("Hidden in the Action Layer.");

      switch (a.key) {
        case "LIVE_DEMO":
          if (!product.demo_url) return off("This product has no demo URL.");
          return { ...a, available: true, reason: null, href: product.demo_url };

        case "BUY_NOW":
        case "ADD_TO_CART":
          if (!purchasable) return off("This product is not purchasable — it has no price, or it is hidden or archived.");
          if (!env.paymentConfigured) return off("No payment provider is configured, so a purchase cannot complete.");
          if (!env.signedIn) return { ...a, available: true, reason: null, href: "/login" };
          return { ...a, available: true, reason: null, href: "/checkout" };

        case "NOTIFY_ME":
          // Only meaningful while the product cannot be bought.
          if (purchasable) return off("The product is available, so there is nothing to be notified about.");
          return { ...a, available: true, reason: null };

        case "VIEW_DETAILS":
          if (!product.slug) return off("This product has no slug, so it has no page to open.");
          return { ...a, available: true, reason: null, href: `/marketplace/product/${product.slug}` };

        case "SHARE":
          if (!product.slug) return off("This product has no canonical URL to share.");
          return { ...a, available: true, reason: null, href: `/marketplace/product/${product.slug}` };

        default:
          return { ...a, available: true, reason: null };
      }
    });
}
