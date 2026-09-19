import { afterEach, describe, expect, it, vi } from "vitest";

import { SingleFlightCache } from "./single-flight-cache";

afterEach(() => vi.useRealTimers());

describe("SingleFlightCache", () => {
  it("computes a key once for any number of concurrent requests", async () => {
    const cache = new SingleFlightCache<string>(60_000);
    let release!: (v: string) => void;
    const compute = vi.fn(() => new Promise<string>((r) => (release = r)));
    const asks = Array.from({ length: 40 }, () => cache.get("page-0", compute));
    expect(cache.inFlight).toBe(1);
    release("rows");
    await expect(Promise.all(asks)).resolves.toEqual(Array(40).fill("rows"));
    expect(compute).toHaveBeenCalledTimes(1);
    expect(cache.inFlight).toBe(0);
  });

  it("answers from the cache until the entry expires, then computes again", async () => {
    vi.useFakeTimers();
    const cache = new SingleFlightCache<number>(60_000);
    let n = 0;
    const compute = () => Promise.resolve(++n);
    expect(await cache.get("k", compute)).toBe(1);
    expect(await cache.get("k", compute)).toBe(1);
    vi.advanceTimersByTime(60_001);
    expect(await cache.get("k", compute)).toBe(2);
  });

  it("does not cache a failure, and every waiter sees it", async () => {
    const cache = new SingleFlightCache<string>(60_000);
    const failing = () => Promise.reject(new Error("db down"));
    const both = [cache.get("k", failing), cache.get("k", failing)];
    await expect(Promise.all(both)).rejects.toThrow("db down");
    await expect(cache.get("k", () => Promise.resolve("ok"))).resolves.toBe("ok");
  });

  it("keeps different keys apart", async () => {
    const cache = new SingleFlightCache<string>(60_000);
    const [a, b] = await Promise.all([
      cache.get("a", () => Promise.resolve("A")),
      cache.get("b", () => Promise.resolve("B")),
    ]);
    expect([a, b]).toEqual(["A", "B"]);
  });
});
