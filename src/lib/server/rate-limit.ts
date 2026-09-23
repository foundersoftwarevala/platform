import { SlidingWindowLimiter, clientAddress } from "@/lib/i18n/limits";

/**
 * Per-visitor limits for the public marketplace APIs (catalogue, search, rows,
 * proof, activity).
 *
 * They had none: nothing stopped one address scraping the whole catalogue
 * page by page, a runaway client looping on search, or a burst of requests
 * exhausting the database. The limits are well above what a person causes -
 * scrolling the entire homepage (93 rows, each topping itself up) is about
 * 100 catalogue requests spread over minutes - and apply per client address,
 * so one abuser does not slow anyone else down.
 *
 * The address is the one nginx vouches for: it overwrites CF-Connecting-IP
 * with $remote_addr, which its real-IP module takes from Cloudflare only when
 * the connection comes from Cloudflare's ranges, so a client cannot choose it.
 *
 * In-process, like the rest of this deployment (one application process). With
 * several processes each would keep its own count; the limits would then be
 * per process, which still bounds abuse.
 */

export type RateBucket = "catalog" | "search" | "public";

const LIMITS: Record<RateBucket, number> = {
  // Requests per client address per minute.
  catalog: 300,
  search: 120,
  public: 240,
};

const limiters: Record<RateBucket, SlidingWindowLimiter> = {
  catalog: new SlidingWindowLimiter(60_000, 20_000),
  search: new SlidingWindowLimiter(60_000, 20_000),
  public: new SlidingWindowLimiter(60_000, 20_000),
};

/**
 * Null when the request may proceed; otherwise the 429 to return. The refusal
 * says when to try again, so a well-behaved client backs off rather than
 * hammering.
 */
export function rateLimited(request: Request, bucket: RateBucket): Response | null {
  const address = clientAddress(request.headers);
  if (!limiters[bucket].hit(address, LIMITS[bucket])) return null;
  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly.", reason: "rate_limited" },
    { status: 429, headers: { "Retry-After": "30", "Cache-Control": "no-store" } },
  );
}

/** Exposed for tests. */
export const RATE_LIMITS = LIMITS;
