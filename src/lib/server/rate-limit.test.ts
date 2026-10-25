import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({
  counts: new Map<string, number>(),
  open: false,
  eval: vi.fn(),
}));

vi.mock("redis", () => ({
  createClient: () => ({
    get isOpen() {
      return redis.open;
    },
    on: vi.fn(),
    connect: async () => {
      redis.open = true;
    },
    eval: redis.eval,
    destroy: vi.fn(() => {
      redis.open = false;
    }),
  }),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestIP: () => "127.0.0.1",
}));

import { RATE_LIMITS, rateLimited } from "./rate-limit";

const req = (ip: string) =>
  new Request("https://softwarevala.net/api/marketplace/search?q=x", {
    headers: { "cf-connecting-ip": ip },
  });

describe("public API rate limit", () => {
  beforeEach(() => {
    redis.counts.clear();
    redis.open = false;
    redis.eval.mockReset().mockImplementation(async (_script, options) => {
      const key = options.keys[0] as string;
      const count = (redis.counts.get(key) ?? 0) + 1;
      redis.counts.set(key, count);
      return count;
    });
    process.env.REDIS_URL = "redis://fixture";
    process.env.NODE_ENV = "test";
  });

  it("allows normal use through the shared Redis counter", async () => {
    expect(RATE_LIMITS.catalog).toBeGreaterThanOrEqual(200);
    for (let i = 0; i < 100; i++) {
      expect(await rateLimited(req("198.51.100.1"), "catalog")).toBeNull();
    }
    expect(redis.eval).toHaveBeenCalledTimes(100);
  });

  it("refuses a flood with 429 and Retry-After", async () => {
    let refused: Response | null = null;
    for (let i = 0; i <= RATE_LIMITS.search && !refused; i++) {
      refused = await rateLimited(req("198.51.100.2"), "search");
    }
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("Retry-After")).toBe("60");
    expect(refused?.headers.get("Cache-Control")).toBe("no-store");
    expect((await refused!.json()).reason).toBe("rate_limited");
  });

  it("does not punish other visitors for one address's flood", async () => {
    for (let i = 0; i <= RATE_LIMITS.search + 5; i++) {
      await rateLimited(req("198.51.100.3"), "search");
    }
    expect(await rateLimited(req("198.51.100.4"), "search")).toBeNull();
  });

  it("counts each endpoint bucket separately", async () => {
    for (let i = 0; i <= RATE_LIMITS.search + 5; i++) {
      await rateLimited(req("198.51.100.5"), "search");
    }
    expect(await rateLimited(req("198.51.100.5"), "catalog")).toBeNull();
  });

  it("fails closed in production when shared Redis is not configured", async () => {
    delete process.env.REDIS_URL;
    process.env.NODE_ENV = "production";

    const response = await rateLimited(req("198.51.100.6"), "lead");

    expect(response?.status).toBe(503);
    expect((await response!.json()).reason).toBe("rate_limit_unavailable");
  });

  it("fails closed in production when shared Redis rejects the counter", async () => {
    process.env.NODE_ENV = "production";
    redis.eval.mockRejectedValueOnce(new Error("Redis unavailable"));

    const response = await rateLimited(req("198.51.100.7"), "contact");

    expect(response?.status).toBe(503);
    expect((await response!.json()).reason).toBe("rate_limit_unavailable");
  });
});
