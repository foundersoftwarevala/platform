/**
 * Taking an operational event in.
 *
 * Three things have to be true of an event pipeline before anything built on
 * top of it can be trusted, and each is enforced here rather than assumed.
 *
 * The same event delivered twice is one event. The unique index on
 * (source_system, source_event_id) settles it in the database, so a retrying
 * producer, a replayed queue and a double-clicked webhook all converge on one
 * row. marketplace_events already worked this way with its dedupe_key; this is
 * the same idea given a constraint instead of a convention.
 *
 * Events arrive out of order, and the latest delivery is not the latest truth.
 * A PAYMENT_COMPLETED that arrives after a PAYMENT_FAILED does not make the
 * payment complete if it happened first. occurred_at and sequence are what
 * decide; received_at only records when we heard.
 *
 * And an event's origin cannot be rewritten. A trigger refuses any update that
 * changes when it happened or where it came from, because a history that can be
 * edited is not a history.
 */

import type { Severity } from "./state.types";

export type EventActor = "HUMAN" | "AI" | "SYSTEM" | "EXTERNAL";

export interface IncomingEvent {
  eventType: string;
  domain: string;
  sourceSystem: string;
  /** The producer's own id for this event. This is what makes it idempotent. */
  sourceEventId: string;
  occurredAt: string;
  entityType?: string | null;
  entityId?: string | null;
  severity?: Severity;
  actorType?: EventActor;
  actorId?: string | null;
  sequence?: number | null;
  correlationId?: string | null;
  causationId?: string | null;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type IngestResult =
  | { accepted: true; id: string; duplicate: false }
  | { accepted: true; id: string; duplicate: true }
  | { accepted: false; reason: string };

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/**
 * Validate before persisting.
 *
 * An event without a source, an id or a time it happened cannot be
 * de-duplicated, ordered or traced, so it is refused rather than stored as a
 * row that will mislead later.
 */
function validate(event: IncomingEvent): string | null {
  if (!event.eventType?.trim()) return "an event needs a type";
  if (!event.domain?.trim()) return "an event needs a domain";
  if (!event.sourceSystem?.trim()) return "an event needs the system it came from";
  if (!event.sourceEventId?.trim())
    return "an event needs the producer's own id, or it cannot be de-duplicated";
  const at = new Date(event.occurredAt ?? "").getTime();
  if (!Number.isFinite(at)) return "an event needs a readable occurred_at";
  // An event from the future is a clock problem, and storing it would put it
  // permanently at the top of every "most recent" list.
  if (at > Date.now() + 5 * 60_000) return "occurred_at is more than five minutes in the future";
  return null;
}

/**
 * Persist one event, returning whether it was new.
 *
 * A duplicate is a success, not an error: the caller did nothing wrong and the
 * state is already correct. It is reported as `duplicate: true` so a producer
 * can tell the difference when it matters.
 */
export async function ingestEvent(event: IncomingEvent): Promise<IngestResult> {
  const problem = validate(event);
  if (problem) return { accepted: false, reason: problem };

  const base = restUrl();
  if (!base) return { accepted: false, reason: "SUPABASE_URL is not configured" };

  const row = {
    event_type: event.eventType.trim(),
    domain: event.domain.trim(),
    source_system: event.sourceSystem.trim(),
    source_event_id: event.sourceEventId.trim(),
    occurred_at: new Date(event.occurredAt).toISOString(),
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    severity: event.severity ?? "INFO",
    actor_type: event.actorType ?? "SYSTEM",
    actor_id: event.actorId ?? null,
    sequence: event.sequence ?? null,
    correlation_id: event.correlationId ?? null,
    causation_id: event.causationId ?? null,
    payload: event.payload ?? {},
    metadata: event.metadata ?? {},
  };

  const response = await fetch(`${base}/rest/v1/founder_events`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(row),
  });

  if (response.ok) {
    const created = (await response.json()) as { id?: string }[];
    return { accepted: true, id: String(created[0]?.id ?? ""), duplicate: false };
  }

  // 409 is the unique index doing its job: this event is already recorded.
  if (response.status === 409) {
    const existing = await fetch(
      `${base}/rest/v1/founder_events?select=id&source_system=eq.${encodeURIComponent(row.source_system)}` +
        `&source_event_id=eq.${encodeURIComponent(row.source_event_id)}&limit=1`,
      { headers: restHeaders() },
    );
    const rows = existing.ok ? ((await existing.json()) as { id?: string }[]) : [];
    return { accepted: true, id: String(rows[0]?.id ?? ""), duplicate: true };
  }

  return { accepted: false, reason: `${response.status} ${(await response.text()).slice(0, 200)}` };
}

/**
 * Whether an event should change a piece of state, given what is already known.
 *
 * This is the out-of-order guard. A newly received event that happened before
 * the one the state was built from does not overwrite it; it is recorded as
 * history and ignored for the current value.
 */
export function supersedes(
  incoming: { occurredAt: string; sequence?: number | null },
  current: { occurredAt: string | null; sequence?: number | null } | null,
): boolean {
  if (!current?.occurredAt) return true;
  const a = new Date(incoming.occurredAt).getTime();
  const b = new Date(current.occurredAt).getTime();
  if (!Number.isFinite(a)) return false;
  if (!Number.isFinite(b)) return true;
  if (a !== b) return a > b;
  // Same instant: a sequence number breaks the tie where the producer gives
  // one. Without it, the existing value stands rather than flapping.
  const sa = incoming.sequence ?? null;
  const sb = current.sequence ?? null;
  if (sa === null || sb === null) return false;
  return sa > sb;
}

/** Several events at once, each judged on its own. */
export async function ingestEvents(events: IncomingEvent[]): Promise<{
  accepted: number;
  duplicates: number;
  refused: Array<{ sourceEventId: string; reason: string }>;
}> {
  let accepted = 0;
  let duplicates = 0;
  const refused: Array<{ sourceEventId: string; reason: string }> = [];

  for (const event of events) {
    const result = await ingestEvent(event);
    if (!result.accepted) {
      refused.push({ sourceEventId: event.sourceEventId ?? "(none)", reason: result.reason });
    } else if (result.duplicate) {
      duplicates += 1;
    } else {
      accepted += 1;
    }
  }

  return { accepted, duplicates, refused };
}
