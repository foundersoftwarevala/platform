import { createHash } from "node:crypto";
import { getRequestIP } from "@tanstack/react-start/server";
import { createClient } from "redis";

import { clientAddress, SlidingWindowLimiter } from "@/lib/i18n/limits";

export type RateBucket =
  | "catalog"
  | "search"
  | "public"
  | "lead"
  | "contact"
  | "application"
  | "affiliate"
  | "rdRequest"
  | "demoProxy"
  | "translate"
  | "qrImage"
  | "qrScan";

const WINDOW_MS = 60_000;
const LIMITS: Record<RateBucket, number> = {
  catalog: 300,
  search: 120,
  public: 240,
  lead: 8,
  contact: 4,
  application: 10,
  affiliate: 10,
  rdRequest: 4,
  demoProxy: 300,
  translate: 60,
  qrImage: 60,
  qrScan: 30,
};
const REDIS_PREFIX = "softwarevala:rate-limit:v1";
const RATE_SCRIPT = `
  local count = redis.call("INCR", KEYS[1])
  if count == 1 then
    redis.call("PEXPIRE", KEYS[1], ARGV[1])
  end
  return count
`;
const localLimiters: Record<RateBucket, SlidingWindowLimiter> = {
  catalog: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  search: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  public: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  lead: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  contact: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  application: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  affiliate: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  rdRequest: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  demoProxy: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  translate: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  qrImage: new SlidingWindowLimiter(WINDOW_MS, 20_000),
  qrScan: new SlidingWindowLimiter(WINDOW_MS, 20_000),
};

const createRedisClient = (url: string) =>
  createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: 300, reconnectStrategy: false },
  });
type RedisClient = ReturnType<typeof createRedisClient>;
let client: RedisClient | null = null;
let connecting: Promise<RedisClient> | null = null;
let lastRedisErrorAt = 0;

function logRedisError(error: unknown): void {
  if (Date.now() - lastRedisErrorAt < 60_000) return;
  lastRedisErrorAt = Date.now();
  console.error(
    "[rate limit] shared Redis unavailable",
    error instanceof Error ? error.message : String(error),
  );
}

async function sharedClient(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  const candidate = createRedisClient(url);
  candidate.on("error", (error) => {
    logRedisError(error);
    if (client === candidate) client = null;
  });
  connecting = candidate
    .connect()
    .then(() => {
      client = candidate;
      return candidate;
    })
    .catch((error: unknown) => {
      candidate.destroy();
      throw error;
    })
    .finally(() => {
      connecting = null;
    });
  return connecting;
}

/** Resolve only the socket peer or an address forwarded by a trusted proxy. */
export function requestAddress(request: Request): string {
  let peer: string | null = null;
  try {
    peer = getRequestIP() ?? null;
  } catch {
    // Outside a request context, ignore caller-controlled forwarding headers.
  }
  return clientAddress(request.headers, peer);
}

function refused(): Response {
  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly.", reason: "rate_limited" },
    { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
  );
}

function unavailable(): Response {
  return Response.json(
    { error: "Request protection is temporarily unavailable.", reason: "rate_limit_unavailable" },
    { status: 503, headers: { "Retry-After": "30", "Cache-Control": "no-store" } },
  );
}

/**
 * Shared, fixed-window rate limiting. Production refuses requests rather than
 * silently falling back to process-local counters when Redis is unavailable.
 */
export async function rateLimited(request: Request, bucket: RateBucket): Promise<Response | null> {
  const address = requestAddress(request);
  try {
    const shared = await sharedClient();
    if (!shared) {
      if (process.env.NODE_ENV === "production") {
        logRedisError(new Error("REDIS_URL is not configured"));
        return unavailable();
      }
      return localLimiters[bucket].hit(address, LIMITS[bucket]) ? refused() : null;
    }

    const digest = createHash("sha256").update(`${bucket}:${address}`).digest("hex");
    const count = Number(
      await shared.eval(RATE_SCRIPT, {
        keys: [`${REDIS_PREFIX}:${digest}`],
        arguments: [String(WINDOW_MS)],
      }),
    );
    return count > LIMITS[bucket] ? refused() : null;
  } catch (error) {
    if (client) {
      client.destroy();
      client = null;
    }
    logRedisError(error);
    return process.env.NODE_ENV === "production" ? unavailable() : null;
  }
}

/** Exposed for tests and callers that need to report configured allowances. */
export const RATE_LIMITS = LIMITS;
