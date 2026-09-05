/** NaN-safe numeric coercion for values coming back from the database
 *  (nullable columns, numeric-as-string, malformed rows). */
export const toNum = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const inr = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(toNum(value));

export const compactInr = (value: number | null | undefined) => {
  const n = toNum(value);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

export const num = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-IN").format(toNum(value));

export const compactNum = (value: number | null | undefined) => {
  const n = toNum(value);
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
};

export const pct = (value: number | null | undefined, digits = 1) =>
  `${toNum(value).toFixed(digits)}%`;

export const shortDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const titleCase = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

export const ctr = (clicks: unknown, impressions: unknown) => {
  const i = toNum(impressions);
  return i > 0 ? (toNum(clicks) / i) * 100 : 0;
};

export const roas = (revenue: unknown, spend: unknown) => {
  const s = toNum(spend);
  return s > 0 ? toNum(revenue) / s : 0;
};

export const cpl = (spend: unknown, leads: unknown) => {
  const l = toNum(leads);
  return l > 0 ? toNum(spend) / l : 0;
};
