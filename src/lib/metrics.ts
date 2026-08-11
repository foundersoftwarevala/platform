// Deterministic sample metrics engine.
// Same (role, key) always yields the same numbers, so the UI is stable across
// renders/reloads while still looking like real production telemetry.

export type Metric = {
  value: number;
  unit?: string;
  deltaPct: number;
  series: number[];
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFrom<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

export function series(seed: string, points = 12, drift = 0.12): number[] {
  const r = rng(seed);
  let v = 0.45 + r() * 0.25;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    v = Math.min(0.98, Math.max(0.08, v + (r() - 0.42) * drift));
    out.push(v);
  }
  return out;
}

export function metricFor(roleKey: string, kpi: { key: string; unit?: string }): Metric {
  const seed = `${roleKey}:${kpi.key}`;
  const r = rng(seed);
  const s = series(seed);
  const unit = kpi.unit;
  let value: number;
  if (unit === "$") value = Math.round((4_000 + r() * 180_000) * s[s.length - 1] * 1.4);
  else if (unit === "%") value = Math.round((35 + r() * 60) * 10) / 10;
  else value = Math.max(1, Math.round((12 + r() * 1400) * s[s.length - 1]));
  const first = s[0];
  const last = s[s.length - 1];
  const deltaPct = Math.round(((last - first) / first) * 1000) / 10;
  return { value, unit, deltaPct, series: s };
}

export function fmtValue(value: number, unit?: string): string {
  if (unit === "$") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value}`;
  }
  if (unit === "%") return `${value}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}