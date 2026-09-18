/**
 * Who may ask for translations, and how much.
 *
 * anonymous: storefront visitors. Interface text only (namespace "ui"), short
 *   strings, and only strings from the interface catalogue are written to
 *   shared translation memory.
 * user: signed-in accounts. Same scope, larger allowance.
 * operator: admin and boss. Any namespace (catalogue content), everything
 *   they translate is written to memory.
 *
 * Request-rate limits are enforced per server instance. Engine work (measured
 * in source characters) is enforced in the database, so it holds across
 * instances; see public.i18n_consume_quota.
 */

export type CallerTier = "anonymous" | "user" | "operator";

export type TierLimits = {
  maxItems: number;
  maxItemChars: number;
  maxTotalChars: number;
  requestsPerMinute: number;
  /** Source characters sent to the engine per hour, per caller. */
  engineCharsPerHour: number;
  namespaces: "ui-only" | "any";
};

export const TIER_LIMITS: Record<CallerTier, TierLimits> = {
  anonymous: {
    maxItems: 40,
    maxItemChars: 300,
    maxTotalChars: 6_000,
    // A page sends its strings in batches (src/lib/language-catalog.ts), about
    // eighteen requests for the homepage, so this leaves room for a visitor to
    // translate a page and keep browsing. The character allowance below, not
    // this counter, is what bounds the cost.
    requestsPerMinute: 60,
    // A full page of interface text is roughly 12k characters, so this allows
    // a visitor to look at several languages; repeat views come from memory
    // and cost nothing.
    engineCharsPerHour: 200_000,
    namespaces: "ui-only",
  },
  user: {
    maxItems: 40,
    maxItemChars: 4_000,
    maxTotalChars: 12_000,
    requestsPerMinute: 60,
    engineCharsPerHour: 500_000,
    namespaces: "ui-only",
  },
  operator: {
    maxItems: 100,
    maxItemChars: 5_000,
    maxTotalChars: 50_000,
    requestsPerMinute: 120,
    engineCharsPerHour: 5_000_000,
    namespaces: "any",
  },
};

/** Engine characters per day for all anonymous visitors together. */
export const ANONYMOUS_DAILY_ENGINE_CHARS = 20_000_000;

/** Largest request body the endpoint reads, in bytes. */
export const MAX_BODY_BYTES = 256_000;

export type RequestShapeError =
  "too_many_items" | "item_too_long" | "too_much_text" | "namespace_not_allowed";

export function checkRequestShape(
  tier: CallerTier,
  input: { texts: readonly string[]; namespace: string },
): RequestShapeError | null {
  const limits = TIER_LIMITS[tier];
  if (input.texts.length > limits.maxItems) return "too_many_items";
  if (input.texts.some((text) => text.length > limits.maxItemChars)) return "item_too_long";
  if (input.texts.reduce((sum, text) => sum + text.length, 0) > limits.maxTotalChars)
    return "too_much_text";
  if (limits.namespaces === "ui-only" && input.namespace !== "ui") return "namespace_not_allowed";
  return null;
}

/**
 * Sliding-window request counter. One per server instance; it bounds bursts,
 * while the database quota bounds cost.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** Records a hit; true when the key is over `limit` within the window. */
  hit(key: string, limit: number, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    recent.push(now);
    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) {
      // Drop the oldest key rather than every key, so one flood does not
      // reset everyone else's window.
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    this.hits.delete(key);
    this.hits.set(key, recent);
    return recent.length > limit;
  }
}

/** Client address from the usual proxy headers. */
export function clientAddress(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
