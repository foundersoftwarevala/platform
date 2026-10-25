import { createClient } from "redis";

import { SingleFlightCache } from "@/lib/server/single-flight-cache";

const CACHE_PREFIX = "softwarevala:cache:v1";
const REDIS_TIMEOUT_MS = 300;
const FALLBACK_TTL_MS = 5_000;

function createRedisClient(url: string) {
  return createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: REDIS_TIMEOUT_MS, reconnectStrategy: false },
  });
}

type RedisClient = ReturnType<typeof createRedisClient>;

const fallback = new SingleFlightCache<unknown>(FALLBACK_TTL_MS, 200);
const pending = new Map<string, Promise<unknown>>();
let client: RedisClient | null = null;
let connecting: Promise<RedisClient | null> | null = null;
let lastErrorAt = 0;

function fallbackGet<T>(key: string, compute: () => Promise<T>): Promise<T> {
  return fallback.get(key, compute) as Promise<T>;
}

function logRedisFailure(error: unknown): void {
  if (Date.now() - lastErrorAt < 60_000) return;
  lastErrorAt = Date.now();
  console.warn(
    "[redis cache] unavailable; using short-lived process cache:",
    error instanceof Error ? error.message : String(error),
  );
}

function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Redis operation timed out")), REDIS_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function redisClient(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (client?.isOpen) return client;
  if (connecting) {
    return bounded(connecting).catch((error: unknown) => {
      logRedisFailure(error);
      return null;
    });
  }

  const candidate = createRedisClient(url);
  candidate.on("error", (error) => {
    logRedisFailure(error);
    if (client === candidate) {
      client = null;
      connecting = null;
    }
  });

  const attempt = candidate
    .connect()
    .then(() => {
      client = candidate;
      return candidate;
    })
    .catch((error: unknown) => {
      logRedisFailure(error);
      candidate.destroy();
      return null;
    })
    .finally(() => {
      connecting = null;
    });
  connecting = attempt;

  return bounded(attempt).catch((error: unknown) => {
    logRedisFailure(error);
    return null;
  });
}

/**
 * Read-through shared cache for public, serializable responses. Redis is an
 * optimization: an unavailable cache falls back to a short-lived local cache
 * and never changes whether the database read succeeds.
 */
export async function redisCached<T>(
  tag: string,
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<T> {
  const localKey = `${tag}:${key}`;
  const running = pending.get(localKey) as Promise<T> | undefined;
  if (running) return running;

  const work = (async () => {
    const current = await redisClient();
    if (!current) return fallbackGet(localKey, compute);

    let cacheKey: string;
    try {
      const version = (await bounded(current.get(`${CACHE_PREFIX}:tag:${tag}`))) ?? "0";
      cacheKey = `${CACHE_PREFIX}:${tag}:${version}:${encodeURIComponent(key)}`;
      const cached = await bounded(current.get(cacheKey));
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (error) {
      logRedisFailure(error);
      return fallbackGet(localKey, compute);
    }

    const value = await compute();
    try {
      const serialized = JSON.stringify(value);
      if (serialized !== undefined) {
        await bounded(
          current.set(cacheKey, serialized, { EX: Math.max(1, Math.ceil(ttlMs / 1000)) }),
        );
      }
    } catch (error) {
      logRedisFailure(error);
      return fallbackGet(localKey, async () => value);
    }
    return value;
  })().finally(() => {
    if (pending.get(localKey) === work) pending.delete(localKey);
  });

  pending.set(localKey, work);
  return work;
}

/** Invalidate a tag across app processes; old entries expire independently. */
export async function invalidateRedisCacheTag(tag: string): Promise<void> {
  fallback.clear();
  const current = await redisClient();
  if (!current) return;
  try {
    await bounded(current.incr(`${CACHE_PREFIX}:tag:${tag}`));
  } catch (error) {
    logRedisFailure(error);
  }
}
