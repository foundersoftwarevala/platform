// Display formatting for dashboard figures.
//
// This file used to also hold a deterministic "sample metrics engine"
// (metricFor/rng/series/pickFrom) that drew invented numbers, deltas and
// sparklines for any dashboard not yet wired to real data. It is gone: every
// figure on a role dashboard is now read from real records or shown as a dash.

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
