import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";

/**
 * Live measurements of the translation system in this server process:
 * request counts and outcomes, latency percentiles over a rolling window,
 * requests per second, cache effectiveness, and the process's own memory and
 * event-loop delay. Read by the Language Manager (GET /api/i18n/admin?view=metrics)
 * and by the host's health check. Server-only.
 */

const WINDOW = 4096; // latency samples kept per series
const RATE_WINDOW_MS = 60_000;

class Series {
  private readonly at = new Float64Array(WINDOW);
  private readonly ms = new Float64Array(WINDOW);
  private next = 0;
  count = 0;

  add(durationMs: number, now = Date.now()) {
    this.at[this.next] = now;
    this.ms[this.next] = durationMs;
    this.next = (this.next + 1) % WINDOW;
    this.count += 1;
  }

  summary(now = Date.now()) {
    const filled = Math.min(this.count, WINDOW);
    const values: number[] = [];
    let recent = 0;
    for (let i = 0; i < filled; i += 1) {
      values.push(this.ms[i]!);
      if (now - this.at[i]! <= RATE_WINDOW_MS) recent += 1;
    }
    values.sort((a, b) => a - b);
    const pick = (q: number) =>
      values.length
        ? Math.round(values[Math.min(values.length - 1, Math.floor(q * values.length))]!)
        : null;
    return {
      total: this.count,
      perSecond: Math.round((recent / (RATE_WINDOW_MS / 1000)) * 100) / 100,
      p50: pick(0.5),
      p95: pick(0.95),
      p99: pick(0.99),
      max: values.length ? Math.round(values[values.length - 1]!) : null,
    };
  }
}

const series = new Map<string, Series>();
const counters = new Map<string, number>();
const startedAt = Date.now();
let loop: IntervalHistogram | null = null;

function loopHistogram(): IntervalHistogram | null {
  if (loop) return loop;
  try {
    loop = monitorEventLoopDelay({ resolution: 20 });
    loop.enable();
  } catch {
    loop = null;
  }
  return loop;
}

/** Record how long something took (milliseconds). */
export function observe(name: string, durationMs: number) {
  let s = series.get(name);
  if (!s) {
    s = new Series();
    series.set(name, s);
  }
  s.add(durationMs);
  loopHistogram();
}

/** Add to a counter. */
export function count(name: string, by = 1) {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export type CacheStats = Record<string, { size: number; hits: number; misses: number }>;

export function metricsSnapshot(caches: CacheStats = {}) {
  const memory = process.memoryUsage();
  const histogram = loopHistogram();
  const cacheSummary = Object.fromEntries(
    Object.entries(caches).map(([name, c]) => {
      const lookups = c.hits + c.misses;
      return [
        name,
        { ...c, hitRatio: lookups ? Math.round((c.hits / lookups) * 1000) / 1000 : null },
      ];
    }),
  );
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters),
    latency: Object.fromEntries([...series].map(([name, s]) => [name, s.summary()])),
    caches: cacheSummary,
    process: {
      rssMb: Math.round(memory.rss / 1e6),
      heapUsedMb: Math.round(memory.heapUsed / 1e6),
      eventLoopDelayMs: histogram
        ? {
            p50: Math.round(histogram.percentile(50) / 1e6),
            p99: Math.round(histogram.percentile(99) / 1e6),
            max: Math.round(histogram.max / 1e6),
          }
        : null,
    },
  };
}
