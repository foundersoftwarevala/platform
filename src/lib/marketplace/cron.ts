/**
 * Cron expressions, parsed and evaluated on the server.
 *
 * Section 6 asks for cron to be server validated and for Next Run and Last Run
 * to be shown, and it is explicit that production scheduling must never depend
 * on a browser timer. Nothing here schedules anything - the host's cron does
 * that. This works out what the host's cron *should* have done, which is the
 * only way section 42's MISSED can mean anything: without an expected time,
 * "the last row is old" is a guess, and with one it is a fact.
 *
 * Standard five fields: minute, hour, day of month, month, day of week.
 * Supports *, lists, ranges and steps, which covers every expression this
 * platform actually uses and the ones an operator is likely to type.
 *
 * Times are UTC because the host's crontab runs in UTC. Saying so is part of
 * the answer - a next run without a timezone is half a fact.
 */

export type CronField = { min: number; max: number; values: Set<number> };

export type ParsedCron = {
  ok: true;
  minute: CronField; hour: CronField; dom: CronField; month: CronField; dow: CronField;
  expression: string;
} | {
  ok: false;
  expression: string;
  error: string;
};

const BOUNDS: [number, number][] = [
  [0, 59],  // minute
  [0, 23],  // hour
  [1, 31],  // day of month
  [1, 12],  // month
  [0, 6],   // day of week, Sunday 0
];

const NAMES = ["minute", "hour", "day of month", "month", "day of week"];

function parseField(raw: string, min: number, max: number, name: string): CronField | string {
  const values = new Set<number>();
  for (const part of raw.split(",")) {
    const piece = part.trim();
    if (!piece) return `The ${name} field has an empty entry.`;

    const [range, stepRaw] = piece.split("/");
    let step = 1;
    if (stepRaw !== undefined) {
      step = Number(stepRaw);
      if (!Number.isInteger(step) || step < 1) return `"${piece}" has an invalid step in the ${name} field.`;
    }

    let from: number;
    let to: number;
    if (range === "*") {
      from = min; to = max;
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b)) return `"${piece}" is not a range in the ${name} field.`;
      from = a; to = b;
    } else {
      const single = Number(range);
      if (!Number.isInteger(single)) return `"${piece}" is not a number in the ${name} field.`;
      from = single; to = stepRaw !== undefined ? max : single;
    }

    if (from < min || to > max || from > to) {
      return `"${piece}" is outside ${min}-${max} in the ${name} field.`;
    }
    for (let v = from; v <= to; v += step) values.add(v);
  }
  if (values.size === 0) return `The ${name} field matches nothing.`;
  return { min, max, values };
}

export function parseCron(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      ok: false, expression,
      error: `A cron expression has five fields; this one has ${parts.length}.`,
    };
  }
  const fields: CronField[] = [];
  for (let i = 0; i < 5; i += 1) {
    const result = parseField(parts[i], BOUNDS[i][0], BOUNDS[i][1], NAMES[i]);
    if (typeof result === "string") return { ok: false, expression, error: result };
    fields.push(result);
  }
  return {
    ok: true, expression,
    minute: fields[0], hour: fields[1], dom: fields[2], month: fields[3], dow: fields[4],
  };
}

/**
 * Whether a given UTC minute matches.
 *
 * Day of month and day of week are OR'd when both are restricted, which is how
 * cron itself behaves and a detail that is easy to get wrong.
 */
function matches(parsed: Extract<ParsedCron, { ok: true }>, at: Date): boolean {
  if (!parsed.minute.values.has(at.getUTCMinutes())) return false;
  if (!parsed.hour.values.has(at.getUTCHours())) return false;
  if (!parsed.month.values.has(at.getUTCMonth() + 1)) return false;

  const domRestricted = parsed.dom.values.size !== 31;
  const dowRestricted = parsed.dow.values.size !== 7;
  const domHit = parsed.dom.values.has(at.getUTCDate());
  const dowHit = parsed.dow.values.has(at.getUTCDay());

  if (domRestricted && dowRestricted) return domHit || dowHit;
  if (domRestricted) return domHit;
  if (dowRestricted) return dowHit;
  return true;
}

/** The next minute at or after `from` that this expression fires on. */
export function nextRun(expression: string, from: Date = new Date()): Date | null {
  const parsed = parseCron(expression);
  if (!parsed.ok) return null;
  const at = new Date(from.getTime());
  at.setUTCSeconds(0, 0);
  at.setUTCMinutes(at.getUTCMinutes() + 1);
  // Two years of minutes is far past any expression that fires at all; an
  // expression that never fires (30 February) returns null rather than looping.
  for (let i = 0; i < 366 * 2 * 24 * 60; i += 1) {
    if (matches(parsed, at)) return at;
    at.setUTCMinutes(at.getUTCMinutes() + 1);
  }
  return null;
}

/** The most recent minute at or before `from` that this expression fired on. */
export function previousRun(expression: string, from: Date = new Date()): Date | null {
  const parsed = parseCron(expression);
  if (!parsed.ok) return null;
  const at = new Date(from.getTime());
  at.setUTCSeconds(0, 0);
  for (let i = 0; i < 366 * 2 * 24 * 60; i += 1) {
    if (matches(parsed, at)) return at;
    at.setUTCMinutes(at.getUTCMinutes() - 1);
  }
  return null;
}

/** Plain English, for the screen. */
export function describeCron(expression: string): string {
  const parsed = parseCron(expression);
  if (!parsed.ok) return parsed.error;
  const every = (field: CronField) => {
    const sorted = [...field.values].sort((a, b) => a - b);
    if (sorted.length === field.max - field.min + 1) return null;
    if (sorted.length > 1) {
      const gap = sorted[1] - sorted[0];
      const even = sorted.every((v, i) => i === 0 || v - sorted[i - 1] === gap);
      if (even && gap > 1) return `every ${gap}`;
    }
    return sorted.join(", ");
  };
  const m = every(parsed.minute);
  const h = every(parsed.hour);
  if (m?.startsWith("every ") && !h) return `Every ${m.slice(6)} minutes.`;
  if (m && h && !m.startsWith("every ") && !h.startsWith("every ")) {
    return `Daily at ${h.padStart(2, "0")}:${m.padStart(2, "0")} UTC.`;
  }
  return `Cron ${expression} (UTC).`;
}
