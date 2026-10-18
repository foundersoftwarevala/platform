import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { ContextIntent, FilteredContext, SnapshotRecord } from "./context.server";
import type { OperatingState } from "./state.types";

/**
 * The Company Operating State, as the application asks for it.
 *
 * Access is the same executive gate the AI CEO console already uses — boss or
 * admin, checked on the server, with the token validated against the auth
 * service using the publishable key. The service-role key is refused by that
 * endpoint, which is what silently emptied the whole AI CEO console before it
 * was found, so this deliberately does not repeat it.
 *
 * Every mutation here writes to audit_logs. The platform already keeps fifteen
 * audit tables and this adds none: a change to what the company is trying to do
 * belongs in the same trail as everything else.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Boss or admin only, and the caller's id, which the audit trail needs. */
async function requireExecutive(): Promise<string> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Executive authentication required");

  const url = process.env["SUPABASE_URL"]?.trim();
  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? process.env["SUPABASE_ANON_KEY"]?.trim();
  if (!url || !publishable) throw new Error("Executive authentication is not configured");

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Executive authentication required");
  const user = (await response.json()) as { id?: string };
  if (!user?.id) throw new Error("Executive authentication required");

  const db = await admin();
  const [{ data: isBoss }, { data: isAdmin }] = await Promise.all([
    db.rpc("has_role", { _user_id: user.id, _role: "boss" }),
    db.rpc("has_role", { _user_id: user.id, _role: "admin" }),
  ]);
  if (!isBoss && !isAdmin) throw new Error("Executive permission required");
  return user.id;
}

/**
 * Record what changed, and who changed it.
 *
 * `actor_kind` separates a human decision from an AI recommendation. The whole
 * governance model depends on that distinction surviving into the record: an
 * AI that proposed something and a founder who accepted it are two acts, and a
 * trail that flattens them into one cannot answer who decided.
 */
async function recordAudit(entry: {
  actorId: string;
  actorKind: "HUMAN" | "AI";
  action: string;
  entity: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}): Promise<void> {
  const url = process.env["SUPABASE_URL"]?.trim();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/audit_logs`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: entry.actorId,
        action: entry.action,
        entity_type: entry.entity,
        entity_id: entry.entityId,
        metadata: {
          actor_kind: entry.actorKind,
          before: entry.before ?? null,
          after: entry.after ?? null,
          reason: entry.reason ?? null,
          module: "founder-ai",
        },
      }),
    });
  } catch (error) {
    // A failed audit write must not swallow the change that succeeded, but it
    // must be visible, because an unaudited change is the thing being avoided.
    console.error("[founder] audit write failed:", error);
  }
}

/** The whole operating state, read live from its sources. */
export const loadFounderState = createServerFn({ method: "GET" }).handler(
  async (): Promise<OperatingState> => {
    await requireExecutive();
    const { loadOperatingState } = await import("./operating-state.server");
    return loadOperatingState();
  },
);

/** Only the part of the state a given question needs. */
export const loadFounderContext = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        intent: z
          .enum(["URGENT", "GOALS", "PERFORMANCE", "RISK", "WORKLOAD", "DEADLINES", "FULL"])
          .default("FULL"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<FilteredContext> => {
    await requireExecutive();
    const { contextFor } = await import("./context.server");
    return contextFor(data.intent as ContextIntent);
  });

/** The newest snapshot, re-judged against events that arrived after it. */
export const loadFounderSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<SnapshotRecord | null> => {
    await requireExecutive();
    const { latestSnapshot } = await import("./context.server");
    return latestSnapshot();
  },
);

/** Build a new snapshot from the authoritative tables. */
export const rebuildFounderSnapshot = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ reason: z.string().min(3).max(200) }).parse(input ?? { reason: "manual rebuild" }),
  )
  .handler(
    async ({ data }): Promise<{ ok: boolean; snapshot?: SnapshotRecord; error?: string }> => {
      const actorId = await requireExecutive();
      const { rebuildState } = await import("./context.server");
      try {
        const snapshot = await rebuildState(data.reason);
        await recordAudit({
          actorId,
          actorKind: "HUMAN",
          action: "Founder AI state rebuilt",
          entity: "founder_state_snapshots",
          entityId: snapshot.id,
          after: { builtAt: snapshot.builtAt, consistency: snapshot.consistency },
          reason: data.reason,
        });
        return { ok: true, snapshot };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "rebuild failed" };
      }
    },
  );

/**
 * Move an attention item along.
 *
 * The valid moves are enforced by a trigger on the table, so an invalid one is
 * refused whatever calls it. Dismissal needs a reason — also enforced there —
 * because an item dismissed without one is how a warning disappears with
 * nobody accountable for the judgement.
 */
export const decideAttention = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "DISMISSED"]),
        reason: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const actorId = await requireExecutive();

    if (data.status === "DISMISSED" && !data.reason?.trim()) {
      return { ok: false, error: "Dismissing an attention item needs a reason." };
    }

    const url = process.env["SUPABASE_URL"]?.trim();
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
    if (!url || !key) return { ok: false, error: "Not configured" };
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };

    const before = await fetch(
      `${url}/rest/v1/founder_attention?select=*&id=eq.${encodeURIComponent(data.id)}&limit=1`,
      { headers },
    );
    const prior = before.ok ? ((await before.json()) as Record<string, unknown>[])[0] : undefined;
    if (!prior) return { ok: false, error: "No attention item has that id." };

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "ACKNOWLEDGED") {
      patch.acknowledged_at = now;
      patch.acknowledged_by = actorId;
    }
    if (data.status === "RESOLVED") {
      patch.resolved_at = now;
      patch.resolved_by = actorId;
    }
    if (data.status === "DISMISSED") {
      patch.dismissed_at = now;
      patch.dismissed_by = actorId;
      patch.dismiss_reason = data.reason?.trim();
    }

    const response = await fetch(
      `${url}/rest/v1/founder_attention?id=eq.${encodeURIComponent(data.id)}`,
      { method: "PATCH", headers, body: JSON.stringify(patch) },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      return { ok: false, error: detail || `Update refused (${response.status})` };
    }

    await recordAudit({
      actorId,
      actorKind: "HUMAN",
      action: `Attention item ${data.status.toLowerCase()}`,
      entity: "founder_attention",
      entityId: data.id,
      before: { status: prior.status },
      after: { status: data.status },
      reason: data.reason ?? null,
    });

    return { ok: true };
  });
