import { describe, expect, it } from "vitest";

import { count, metricsSnapshot, observe } from "../metrics.server";

describe("translation metrics", () => {
  it("reports percentiles, rate and counters", () => {
    for (let i = 1; i <= 100; i += 1) observe("test.latency", i);
    count("test.requests", 3);
    count("test.requests");
    const snap = metricsSnapshot({ memory: { size: 5, hits: 3, misses: 1 } });
    const s = snap.latency["test.latency"]!;
    expect(s.total).toBe(100);
    expect(s.p50).toBe(51);
    expect(s.p95).toBe(96);
    expect(s.p99).toBe(100);
    expect(s.max).toBe(100);
    expect(s.perSecond).toBeCloseTo(100 / 60, 1);
    expect(snap.counters["test.requests"]).toBe(4);
    expect(snap.caches.memory).toEqual({ size: 5, hits: 3, misses: 1, hitRatio: 0.75 });
    expect(snap.process.rssMb).toBeGreaterThan(0);
  });
});
