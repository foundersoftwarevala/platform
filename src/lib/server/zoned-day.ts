/**
 * Midnight today and the first of this month, as real instants, in the
 * operator's own time zone.
 *
 * The consoles that count "today" built `new Date("YYYY-MM-DDT00:00:00")`,
 * which is read in the *server's* zone. On a UTC server an operator in India
 * had "today" start at 05:30, so everything between midnight and 05:30 was
 * missing from "New today" while the screen said "Counted in Asia/Kolkata".
 */

/** A zone the runtime knows, or the fallback. An unknown zone threw a 500. */
export function validZone(asked: string | null | undefined, fallback = "Asia/Kolkata"): string {
  const zone = String(asked ?? "").trim().slice(0, 60);
  if (!zone) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return fallback;
  }
}

/** How far the zone's wall clock is ahead of UTC at one instant, in ms. */
function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** The instant at which the zone's wall clock reads y-m-d 00:00. */
function zonedMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetAt(guess, timeZone);
  // Once more at the answer, for the day a clock change happens on.
  return new Date(guess - offsetAt(first, timeZone));
}

export function zonedBoundaries(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 1);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  return {
    startOfDay: zonedMidnight(y, m, d, timeZone).toISOString(),
    startOfMonth: zonedMidnight(y, m, 1, timeZone).toISOString(),
  };
}
