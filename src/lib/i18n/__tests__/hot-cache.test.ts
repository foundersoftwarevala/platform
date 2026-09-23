import { describe, expect, it } from "vitest";

import { SingleFlight, TtlCache } from "../hot-cache";

describe("TtlCache", () => {
  it("returns a value until it expires", () => {
    const cache = new TtlCache<string>(10);
    cache.set("a", "x", 1000, 0);
    expect(cache.get("a", 999)).toBe("x");
    expect(cache.get("a", 1000)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("drops the least recently used entry when full", () => {
    const cache = new TtlCache<number>(2);
    cache.set("a", 1, 10_000, 0);
    cache.set("b", 2, 10_000, 0);
    cache.get("a", 1); // a is now the most recent
    cache.set("c", 3, 10_000, 2);
    expect(cache.get("b", 3)).toBeUndefined();
    expect(cache.get("a", 3)).toBe(1);
    expect(cache.get("c", 3)).toBe(3);
  });

  it("counts hits and misses and deletes by prefix", () => {
    const cache = new TtlCache<number>(10);
    cache.set("en|hi|1", 1, 10_000, 0);
    cache.set("en|hi|2", 2, 10_000, 0);
    cache.set("en|ta|1", 3, 10_000, 0);
    cache.get("en|hi|1", 1);
    cache.get("missing", 1);
    expect([cache.hits, cache.misses]).toEqual([1, 1]);
    cache.deletePrefix("en|hi|");
    expect(cache.size).toBe(1);
    cache.deletePrefix("");
    expect(cache.size).toBe(0);
  });
});

describe("SingleFlight", () => {
  it("runs one load for concurrent callers of the same key", async () => {
    const flight = new SingleFlight<number>();
    let loads = 0;
    let release!: (v: number) => void;
    const load = () =>
      new Promise<number>((resolve) => {
        loads += 1;
        release = resolve;
      });
    const calls = [flight.run("k", load), flight.run("k", load), flight.run("k", load)];
    expect(flight.pending).toBe(1);
    release(7);
    expect(await Promise.all(calls)).toEqual([7, 7, 7]);
    expect(loads).toBe(1);
    expect(flight.shared).toBe(2);
    expect(flight.pending).toBe(0);
  });

  it("starts a new load after the previous one settled, including a failed one", async () => {
    const flight = new SingleFlight<number>();
    await expect(flight.run("k", () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    expect(await flight.run("k", () => Promise.resolve(2))).toBe(2);
  });
});

describe("TtlCache.peek", () => {
  it("reads without counting or expiring early", () => {
    const cache = new TtlCache<number>(10);
    cache.set("a", 1, 1000, 0);
    expect(cache.peek("a", 10)).toBe(1);
    expect(cache.peek("a", 1000)).toBeUndefined();
    expect([cache.hits, cache.misses]).toEqual([0, 0]);
  });
});
