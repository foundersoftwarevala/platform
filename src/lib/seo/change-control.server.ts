/**
 * Nothing changes SEO data without leaving a way back.
 *
 * Section 19: a change is a proposal until somebody accepts it, what it
 * replaced is kept, and high-impact changes wait for approval. The reason is
 * plain - an AI suggestion that rewrites the keyword set of one card slot is
 * one request away from rewriting 7,280 of them, and "undo" has to be a stored
 * value rather than a memory of what it used to be.
 *
 * Every path here writes seo_change_requests. A caller never patches the
 * target table itself; it proposes, and publishing is a separate recorded act.
 */

export type ChangeState =
  | "DRAFT"
  | "ANALYSIS"
  | "QA"
  | "APPROVAL_REQUIRED"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "ROLLED_BACK";

export type ChangeSource = "manual" | "ai" | "crawler" | "automation";

export type ChangeRequest = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  target_url: string | null;
  field: string;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  source: ChangeSource;
  provider: string | null;
  model: string | null;
  state: ChangeState;
  qa_findings: unknown[];
  impact: "normal" | "high";
  rollback_of: string | null;
  created_at: string;
};

/** Which tables this may write, and which column identifies a row in each. */
const TARGETS: Record<string, { table: string; key: string }> = {
  card_slot: { table: "marketplace_card_slots", key: "id" },
  seo_page: { table: "seo_pages", key: "id" },
  meta_rule: { table: "seo_meta_rules", key: "id" },
};

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

async function rest(path: string, init?: RequestInit) {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(url + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Whether a change is big enough to need somebody to say yes.
 *
 * Deliberately blunt: anything an AI proposed, anything on a field that
 * decides whether a page may be indexed at all, and anything that replaces a
 * list rather than filling an empty one. Being wrong in this direction costs
 * an operator one click; being wrong in the other costs a catalogue.
 */
export function needsApproval(input: {
  field: string;
  source: ChangeSource;
  oldValue: unknown;
  newValue: unknown;
}): boolean {
  if (input.source === "ai") return true;
  if (/^(index_status|canonical_url|robots|sitemap|indexnow_enabled|status)$/i.test(input.field)) {
    return true;
  }
  if (Array.isArray(input.oldValue) && Array.isArray(input.newValue)) {
    return input.oldValue.length > 0;
  }
  return false;
}

/**
 * Record a proposed change, with whatever it would replace.
 *
 * The old value is read now rather than at publish time: the point of keeping
 * it is to put back what was there when the decision was taken.
 */
export async function proposeChange(input: {
  entityType: string;
  entityId: string;
  field: string;
  newValue: unknown;
  reason: string;
  source: ChangeSource;
  targetUrl?: string | null;
  provider?: string | null;
  model?: string | null;
  qaFindings?: unknown[];
  requestedBy?: string | null;
}): Promise<ChangeRequest> {
  const target = TARGETS[input.entityType];
  if (!target) throw new Error(input.entityType + " is not a table this may change.");

  let oldValue: unknown = null;
  const current = await rest(
    target.table +
      "?select=" +
      encodeURIComponent(input.field) +
      "&" +
      target.key +
      "=eq." +
      encodeURIComponent(input.entityId) +
      "&limit=1",
  );
  if (current.ok) {
    const rows = (await current.json()) as Record<string, unknown>[];
    if (rows[0]) oldValue = rows[0][input.field] ?? null;
  }

  const approval = needsApproval({
    field: input.field,
    source: input.source,
    oldValue,
    newValue: input.newValue,
  });

  const response = await rest("seo_change_requests", {
    method: "POST",
    body: JSON.stringify({
      entity_type: input.entityType,
      entity_id: input.entityId,
      target_url: input.targetUrl ?? null,
      field: input.field,
      old_value: oldValue,
      new_value: input.newValue,
      reason: input.reason,
      source: input.source,
      provider: input.provider ?? null,
      model: input.model ?? null,
      qa_findings: input.qaFindings ?? [],
      impact: approval ? "high" : "normal",
      state: approval ? "APPROVAL_REQUIRED" : "APPROVED",
      requested_by: input.requestedBy ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error("the change could not be recorded: HTTP " + response.status);
  }
  return ((await response.json()) as ChangeRequest[])[0];
}

async function readChange(id: string): Promise<ChangeRequest | null> {
  const found = await rest(
    "seo_change_requests?select=*&id=eq." + encodeURIComponent(id) + "&limit=1",
  );
  const rows = found.ok ? ((await found.json()) as ChangeRequest[]) : [];
  return rows[0] ?? null;
}

/** Record that somebody said yes. */
export async function approveChange(
  id: string,
  approvedBy?: string | null,
): Promise<ChangeRequest> {
  const change = await readChange(id);
  if (!change) throw new Error("no such change request");
  if (change.state !== "APPROVAL_REQUIRED" && change.state !== "QA") {
    throw new Error("a change in state " + change.state + " is not waiting for approval.");
  }
  const done = await rest("seo_change_requests?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    body: JSON.stringify({
      state: "APPROVED",
      approved_by: approvedBy ?? null,
      approved_at: new Date().toISOString(),
    }),
  });
  return ((await done.json()) as ChangeRequest[])[0];
}

/**
 * Write an approved change to the table it belongs to.
 *
 * Refuses anything not approved. That refusal is the whole mechanism: without
 * it the state column would be a label rather than a gate.
 */
export async function publishChange(id: string): Promise<ChangeRequest> {
  const change = await readChange(id);
  if (!change) throw new Error("no such change request");
  if (change.state !== "APPROVED") {
    throw new Error("a change in state " + change.state + " may not be published.");
  }

  const target = TARGETS[change.entity_type];
  if (!target || !change.entity_id) throw new Error("this change names nothing to write to.");

  const write = await rest(
    target.table + "?" + target.key + "=eq." + encodeURIComponent(change.entity_id),
    { method: "PATCH", body: JSON.stringify({ [change.field]: change.new_value }) },
  );
  if (!write.ok) throw new Error("the write failed: HTTP " + write.status);

  const done = await rest("seo_change_requests?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    body: JSON.stringify({ state: "PUBLISHED", published_at: new Date().toISOString() }),
  });
  return ((await done.json()) as ChangeRequest[])[0];
}

/**
 * Put back what a published change replaced.
 *
 * This writes a second request rather than editing the first, so the history
 * shows that a thing was done and then undone, which is what happened.
 */
export async function rollbackChange(id: string): Promise<ChangeRequest> {
  const change = await readChange(id);
  if (!change) throw new Error("no such change request");
  if (change.state !== "PUBLISHED") {
    throw new Error(
      "a change in state " + change.state + " has not been published, so there is nothing to undo.",
    );
  }

  const target = TARGETS[change.entity_type];
  if (!target || !change.entity_id) throw new Error("this change names nothing to write to.");

  const write = await rest(
    target.table + "?" + target.key + "=eq." + encodeURIComponent(change.entity_id),
    { method: "PATCH", body: JSON.stringify({ [change.field]: change.old_value }) },
  );
  if (!write.ok) throw new Error("the rollback write failed: HTTP " + write.status);

  await rest("seo_change_requests?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    body: JSON.stringify({ state: "ROLLED_BACK", rolled_back_at: new Date().toISOString() }),
  });

  const undo = await rest("seo_change_requests", {
    method: "POST",
    body: JSON.stringify({
      entity_type: change.entity_type,
      entity_id: change.entity_id,
      target_url: change.target_url,
      field: change.field,
      old_value: change.new_value,
      new_value: change.old_value,
      reason: "Rollback of " + change.id,
      source: "manual",
      state: "PUBLISHED",
      impact: change.impact,
      rollback_of: change.id,
      published_at: new Date().toISOString(),
    }),
  });
  return ((await undo.json()) as ChangeRequest[])[0];
}
