import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const values = new Map<string, string>();
  const client = {
    isOpen: false,
    connect: vi.fn(async () => {
      client.isOpen = true;
    }),
    on: vi.fn(),
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
      return "OK";
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(values.get(key) ?? 0) + 1;
      values.set(key, String(next));
      return next;
    }),
    destroy: vi.fn(),
  };
  return { values, client };
});

vi.mock("redis", () => ({ createClient: vi.fn(() => fake.client) }));

import { invalidateRedisCacheTag, redisCached } from "./redis-cache.server";

describe("Redis response cache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    fake.values.clear();
    fake.client.isOpen = false;
    vi.clearAllMocks();
    fake.client.get.mockImplementation(async (key: string) => fake.values.get(key) ?? null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shares a cached response between calls", async () => {
    const compute = vi.fn(async () => ({ rows: [1, 2] }));

    await expect(redisCached("test", "page", 10_000, compute)).resolves.toEqual({
      rows: [1, 2],
    });
    await expect(redisCached("test", "page", 10_000, compute)).resolves.toEqual({
      rows: [1, 2],
    });

    expect(compute).toHaveBeenCalledOnce();
  });

  it("invalidates a response across cache versions", async () => {
    const compute = vi.fn(async () => ({ revision: compute.mock.calls.length }));

    await redisCached("test-invalidate", "page", 10_000, compute);
    await invalidateRedisCacheTag("test-invalidate");
    const refreshed = await redisCached("test-invalidate", "page", 10_000, compute);

    expect(refreshed.revision).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("falls back to local single-flight caching when Redis reads fail", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.client.get.mockRejectedValue(new Error("connection lost"));
    const compute = vi.fn(async () => ({ available: true }));

    await expect(redisCached("test-fallback", "page", 10_000, compute)).resolves.toEqual({
      available: true,
    });
    await expect(redisCached("test-fallback", "page", 10_000, compute)).resolves.toEqual({
      available: true,
    });

    expect(compute).toHaveBeenCalledOnce();
  });
});
