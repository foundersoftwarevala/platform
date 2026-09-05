/**
 * Enterprise formatting primitives shared by every affiliate-manager wall.
 * Money is always stored in minor units (cents); dates are ISO strings.
 */

export type Currency = "USD" | "EUR" | "GBP" | "INR" | (string & {});

const moneyCache = new Map<string, Intl.NumberFormat>();

function nf(currency: string, opts: Intl.NumberFormatOptions) {
  const key = currency + JSON.stringify(opts);
  let f = moneyCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: "currency", currency, ...opts });
    moneyCache.set(key, f);
  }
  return f;
}

/** Full-precision money, e.g. $1,240.50 */
export function formatMoney(cents: number | null | undefined, currency: Currency = "USD") {
  const n = (cents ?? 0) / 100;
  try {
    return nf(currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Compact money for KPI tiles, e.g. $1.2M */
export function formatMoneyCompact(cents: number | null | undefined, currency: Currency = "USD") {
  const n = (cents ?? 0) / 100;
  try {
    return nf(currency, {
      notation: Math.abs(n) >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(n) >= 10_000 ? 1 : 2,
      minimumFractionDigits: Math.abs(n) >= 10_000 ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function formatNumber(n: number | null | undefined) {
  return (n ?? 0).toLocaleString();
}

export function formatPercent(v: number | null | undefined, digits = 1) {
  if (v == null) return "—";
  return `${v.toFixed(digits)}%`;
}

/** Splits money into integer + fraction so tables can de-emphasise cents. */
export function splitMoney(cents: number | null | undefined, currency: Currency = "USD") {
  const full = formatMoney(cents, currency);
  const idx = full.lastIndexOf(".");
  if (idx === -1) return { major: full, minor: "" };
  return { major: full.slice(0, idx), minor: full.slice(idx) };
}

export function parseDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** "12 Mar 2025" */
export function formatDate(v: string | Date | null | undefined) {
  const d = parseDate(v);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "12 Mar 2025, 14:08" */
export function formatDateTime(v: string | Date | null | undefined) {
  const d = parseDate(v);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Absolute timestamp with timezone — used inside tooltips. */
export function formatAbsolute(v: string | Date | null | undefined) {
  const d = parseDate(v);
  if (!d) return "—";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${d.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })} (${tz})`;
}

const DIVISIONS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.34524, "week"], [12, "month"], [Infinity, "year"],
];

/** "3 minutes ago" / "in 2 days" */
export function formatRelative(v: string | Date | null | undefined) {
  const d = parseDate(v);
  if (!d) return "—";
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  let duration = (d.getTime() - Date.now()) / 1000;
  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(duration) < amount) return rtf.format(Math.round(duration), unit);
    duration /= amount;
  }
  return formatDate(d);
}

/** Two-letter initials for avatars. */
export function initials(name: string | null | undefined) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || name[0].toUpperCase();
}
