// Small timezone helpers for scheduling controls (no external deps).

export const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
] as const;

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value])) as Record<string, string>;
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asUTC - date.getTime();
}

/** "YYYY-MM-DDTHH:mm" wall clock in `tz` -> UTC ISO string. */
export function wallToUtcIso(wall: string, tz: string): string | null {
  if (!wall) return null;
  const guess = new Date(`${wall}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  let utc = new Date(guess.getTime() - tzOffsetMs(tz, guess));
  utc = new Date(guess.getTime() - tzOffsetMs(tz, utc));
  return utc.toISOString();
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" wall clock in `tz` (for datetime-local inputs). */
export function utcIsoToWall(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + tzOffsetMs(tz, d)).toISOString().slice(0, 16);
}

/** Human label like "12 Mar 2026, 18:30 (Asia/Kolkata)". */
export function formatInTz(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${s} (${tz})`;
}

export function relativeFromNow(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const unit = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}
