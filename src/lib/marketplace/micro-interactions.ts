/**
 * Storefront micro-interactions: the eight the screen has always listed, and
 * what each one can actually do here.
 *
 * The screen showed eight cards, every switch on, four surface chips on each,
 * and a Save Configuration button that saved nothing. The switches and the
 * chips were the same eight and four regardless of whether anything behind them
 * existed.
 *
 * Section 12 has the sentence that decides the shape of this file: do not
 * expose settings that the underlying implementation cannot support. So each
 * feature declares which settings are real for it, and the server fills in what
 * is standing in the way where something is not. A frequency control over a
 * feature nothing can measure, or an "authenticated" toggle over a feature that
 * only has browser storage, is a setting that lies to whoever sets it.
 *
 * Configuration lives in system_settings under one key, the way the Action
 * Layer registry, the colour palette and the permission matrix already do -
 * section 23 asks not to add tables where existing infrastructure is already
 * the source of truth, and there is no path to DDL here in any case.
 */

export const MICRO_KEY = "marketplace_micro_interactions";

export type Surface = "homepage" | "pdp" | "cart" | "search";

export const SURFACES: { id: Surface; label: string }[] = [
  { id: "homepage", label: "Homepage" },
  { id: "pdp", label: "PDP" },
  { id: "cart", label: "Cart" },
  { id: "search", label: "Search" },
];

export type Frequency = "always" | "once_per_session" | "once_per_day" | "once_per_user";

export const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: "always", label: "Always" },
  { id: "once_per_session", label: "Once per session" },
  { id: "once_per_day", label: "Once per day" },
  { id: "once_per_user", label: "Once per user" },
];

export type MicroKey =
  | "continue_browsing" | "recently_viewed" | "save_for_later" | "quick_preview"
  | "quick_buy" | "quick_demo" | "one_click_share" | "add_to_cart_burst";

/** Which of the section 12 settings are meaningful for a given feature. */
export type Supports = {
  surfaces: boolean;
  frequency: boolean;
  animation: boolean;
  device: boolean;
  audience: boolean;
  /** Recently Viewed is the only one with a count. */
  count: boolean;
};

export type MicroConfig = {
  key: MicroKey;
  enabled: boolean;
  surfaces: Surface[];
  frequency: Frequency;
  animation: boolean;
  animation_ms: number;
  desktop: boolean;
  mobile: boolean;
  anonymous: boolean;
  authenticated: boolean;
  count: number;
};

export type MicroDefinition = {
  key: MicroKey;
  label: string;
  description: string;
  supports: Supports;
  /** The Action Layer key this feature cannot outlive - section 20. */
  requiresAction: string | null;
  /** Where its data actually lives, in one honest phrase. */
  storage: string;
};

const ALL: Supports = {
  surfaces: true, frequency: true, animation: true, device: true, audience: true, count: false,
};

/**
 * The eight, in the order the screen has always shown them, with the same
 * labels and the same descriptions. Nothing has been renamed.
 */
export const DEFINITIONS: MicroDefinition[] = [
  {
    key: "continue_browsing",
    label: "Continue Browsing",
    description: "Resume the last category / wall visitors were exploring.",
    supports: { ...ALL, animation: false },
    requiresAction: null,
    storage: "The visitor's own browser. Nothing about where somebody browsed is written to a shared table.",
  },
  {
    key: "recently_viewed",
    label: "Recently Viewed",
    description: "Last 12 products viewed, surfaced on PDP and homepage.",
    supports: { ...ALL, animation: false, count: true },
    requiresAction: null,
    storage: "marketplace_events product_view rows, scoped to the viewer's own session or account.",
  },
  {
    key: "save_for_later",
    label: "Save For Later",
    description: "Lightweight wishlist alternative without account friction.",
    supports: { ...ALL, animation: false, frequency: false },
    requiresAction: "WISHLIST",
    storage: "The existing favourites store in the visitor's browser (sv.home.favorites.v1). There is no saved-products table.",
  },
  {
    key: "quick_preview",
    label: "Quick Preview",
    description: "Hover or tap preview without leaving the wall.",
    supports: { ...ALL },
    requiresAction: "VIEW_DETAILS",
    storage: "marketplace_products. The preview reads the canonical product, never a copy of it.",
  },
  {
    key: "quick_buy",
    label: "Quick Buy",
    description: "1-click checkout for returning, verified customers.",
    supports: { ...ALL, animation: false },
    requiresAction: "BUY_NOW",
    storage: "marketplace_carts and the checkout flow.",
  },
  {
    key: "quick_demo",
    label: "Quick Demo",
    description: "Launch the live demo sandbox in an overlay.",
    supports: { ...ALL },
    requiresAction: "LIVE_DEMO",
    storage: "marketplace_products.demo_url and the existing demo routes.",
  },
  {
    key: "one_click_share",
    label: "One-Click Share",
    description: "Native share + copy-link with UTM auto-tagging.",
    supports: { ...ALL, animation: false },
    requiresAction: "SHARE",
    storage: "product_share_events, plus marketplace_events for the interaction itself.",
  },
  {
    key: "add_to_cart_burst",
    label: "Add To Cart Burst",
    description: "Premium micro-animation on add-to-cart success.",
    supports: { ...ALL, frequency: false },
    requiresAction: "ADD_TO_CART",
    storage: "marketplace_carts and marketplace_cart_items. The animation follows the write; it never precedes it.",
  },
];

/** Software Vala's own defaults. Reset restores exactly these. */
export function defaultConfig(): Record<MicroKey, MicroConfig> {
  const out = {} as Record<MicroKey, MicroConfig>;
  for (const d of DEFINITIONS) {
    out[d.key] = {
      key: d.key,
      enabled: true,
      surfaces: d.key === "add_to_cart_burst" ? ["pdp", "cart"] : ["homepage", "pdp", "cart", "search"],
      frequency: "always",
      animation: d.supports.animation,
      animation_ms: 320,
      desktop: true,
      mobile: true,
      anonymous: true,
      authenticated: true,
      count: d.key === "recently_viewed" ? 12 : 0,
    };
  }
  return out;
}

export type ValidationIssue = { key: string; field: string; reason: string };

/**
 * Validate a submitted configuration.
 *
 * Section 2 asks for validation before the write, and section 26 asks that
 * nothing fail silently. So an unusable value is named with its feature and its
 * field rather than being clamped into something the operator did not ask for.
 */
export function validateConfig(
  input: unknown,
): { ok: true; config: Record<MicroKey, MicroConfig> } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const base = defaultConfig();
  const supplied = (input ?? {}) as Record<string, Partial<MicroConfig>>;
  const known = new Set(DEFINITIONS.map((d) => d.key as string));
  const surfaceIds = new Set(SURFACES.map((s) => s.id as string));
  const frequencyIds = new Set(FREQUENCIES.map((f) => f.id as string));

  for (const key of Object.keys(supplied)) {
    if (!known.has(key)) {
      issues.push({ key, field: "key", reason: "Not a micro-interaction on this storefront." });
    }
  }

  for (const definition of DEFINITIONS) {
    const given = supplied[definition.key];
    if (!given) continue;
    const target = base[definition.key];
    // Snapshotted before target is touched, so the comparison is against what
    // shipped rather than against a value this loop has already changed.
    const shipped = { ...base[definition.key] };

    /**
     * A field the feature does not support is only a problem when somebody is
     * trying to change it. A stored configuration carries every field for every
     * feature, so the same value arriving back at its default is not a request
     * for anything and must not be refused.
     */
    const untouched = (field: keyof MicroConfig) =>
      given[field] === undefined || given[field] === shipped[field];

    if (given.enabled !== undefined) target.enabled = Boolean(given.enabled);

    if (given.surfaces !== undefined) {
      if (!Array.isArray(given.surfaces)) {
        issues.push({ key: definition.key, field: "surfaces", reason: "Surfaces must be a list." });
      } else {
        const bad = given.surfaces.filter((s) => !surfaceIds.has(String(s)));
        if (bad.length) {
          issues.push({
            key: definition.key, field: "surfaces",
            reason: `Not a storefront surface: ${bad.join(", ")}.`,
          });
        } else if (given.surfaces.length === 0 && given.enabled !== false) {
          // An enabled feature with nowhere to appear is a configuration that
          // silently does nothing, which is worse than being switched off.
          issues.push({
            key: definition.key, field: "surfaces",
            reason: "An enabled interaction needs at least one surface, or it appears nowhere.",
          });
        } else {
          target.surfaces = given.surfaces as Surface[];
        }
      }
    }

    if (given.frequency !== undefined && !untouched("frequency")) {
      if (!definition.supports.frequency) {
        issues.push({
          key: definition.key, field: "frequency",
          reason: `${definition.label} has no frequency control; it responds to a click rather than appearing on its own.`,
        });
      } else if (!frequencyIds.has(String(given.frequency))) {
        issues.push({ key: definition.key, field: "frequency", reason: `Unknown frequency "${given.frequency}".` });
      } else {
        target.frequency = given.frequency as Frequency;
      }
    }

    if (given.animation !== undefined && !untouched("animation")) {
      if (!definition.supports.animation) {
        issues.push({
          key: definition.key, field: "animation",
          reason: `${definition.label} has no animation to turn off.`,
        });
      } else {
        target.animation = Boolean(given.animation);
      }
    }

    if (given.animation_ms !== undefined) {
      const value = Number(given.animation_ms);
      if (!Number.isFinite(value) || value < 80 || value > 2000) {
        issues.push({
          key: definition.key, field: "animation_ms",
          reason: "An animation runs between 80 and 2000 milliseconds.",
        });
      } else {
        target.animation_ms = Math.round(value);
      }
    }

    if (given.count !== undefined && !untouched("count")) {
      if (!definition.supports.count) {
        issues.push({ key: definition.key, field: "count", reason: `${definition.label} has no count.` });
      } else {
        const value = Number(given.count);
        if (!Number.isInteger(value) || value < 1 || value > 60) {
          issues.push({ key: definition.key, field: "count", reason: "Between 1 and 60 products." });
        } else {
          target.count = value;
        }
      }
    }

    for (const flag of ["desktop", "mobile", "anonymous", "authenticated"] as const) {
      if (given[flag] !== undefined) target[flag] = Boolean(given[flag]);
    }

    if (target.enabled && !target.desktop && !target.mobile) {
      issues.push({
        key: definition.key, field: "device",
        reason: "Switched on for neither desktop nor mobile, so it would never appear.",
      });
    }
    if (target.enabled && !target.anonymous && !target.authenticated) {
      issues.push({
        key: definition.key, field: "audience",
        reason: "Switched on for neither signed-out nor signed-in visitors, so it would never appear.",
      });
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, config: base };
}
