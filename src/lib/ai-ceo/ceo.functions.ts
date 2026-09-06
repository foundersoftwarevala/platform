import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { CEOState, CEOSuggestion } from "./types";

/**
 * The AI CEO module's server API.
 *
 * This replaces the imported module's `AIRA_API_URL` client, which pointed at
 * an external Prisma service that was never stood up: every call returned
 * `configured: false` and the UI quietly fell back to in-memory seed data, so
 * nothing an operator did survived a reload. These handlers read and write the
 * platform's own PostgreSQL through the same Supabase admin client the rest of
 * the project's server functions use.
 *
 * Access is restricted to `boss` and `admin`. There is no `ceo` role in
 * user_roles; those two are the executive roles the Control Panel already uses
 * for this tier, and the module shows platform-wide revenue, risk and customer
 * data, so it must not be readable by an ordinary signed-in account.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Boss or admin only. Throws for anyone else, including a signed-in customer. */
async function requireExecutive() {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Executive authentication required");

  const db = await admin();
  const { data: user, error } = await db.auth.getUser(token);
  if (error || !user.user) throw new Error("Executive authentication required");

  const [{ data: isBoss }, { data: isAdmin }] = await Promise.all([
    db.rpc("has_role", { _user_id: user.user.id, _role: "boss" }),
    db.rpc("has_role", { _user_id: user.user.id, _role: "admin" }),
  ]);
  if (!isBoss && !isAdmin) throw new Error("Executive permission required");
  return user.user.id;
}

/**
 * Everything the dashboard needs, in one round trip.
 *
 * The module used to make a call for state and then generate the rest on the
 * client. Measurements belong on the server — they come from tables the browser
 * cannot read — and one request avoids six waterfalls on first paint.
 */
export const loadCeoState = createServerFn({ method: "GET" }).handler(
  async (): Promise<CEOState> => {
    await requireExecutive();

    const [{ readSuggestions, readLastRefresh }, signals] = await Promise.all([
      import("./store.server"),
      import("./signals.server"),
    ]);

    const degraded: string[] = [];
    const [suggestions, lastRefresh, metrics, observations, activityEvents, decisions] =
      await Promise.all([
        readSuggestions(),
        readLastRefresh(),
        signals.computeMetrics(degraded),
        signals.computeObservations(degraded),
        signals.computeActivity(degraded),
        signals.loadDecisions(degraded),
      ]);

    return {
      persisted: true,
      suggestions,
      lastRefresh,
      metrics,
      metricSources: signals.METRIC_SOURCES,
      observations,
      activityEvents,
      decisions,
      degraded,
    };
  },
);

/** Recompute the live figures without re-reading the stored suggestion set. */
export const refreshSignals = createServerFn({ method: "POST" }).handler(async () => {
  await requireExecutive();
  const signals = await import("./signals.server");
  const { writeLastRefresh } = await import("./store.server");

  const degraded: string[] = [];
  const [metrics, observations, activityEvents] = await Promise.all([
    signals.computeMetrics(degraded),
    signals.computeObservations(degraded),
    signals.computeActivity(degraded),
  ]);

  const at = new Date().toISOString();
  const persisted = await writeLastRefresh(at);

  return {
    persisted,
    lastRefresh: at,
    metrics,
    metricSources: signals.METRIC_SOURCES,
    observations,
    activityEvents,
    degraded,
  };
});

/**
 * Forward a suggestion to the Boss review queue.
 *
 * The suggestion is marked `reviewed` where it lives and a copy is appended to
 * the queue with its status reset to `pending`, so the Boss sees an open
 * decision rather than something already handled.
 */
export const sendSuggestionToBoss = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    await requireExecutive();
    const store = await import("./store.server");

    const { ok, suggestion } = await store.setSuggestionStatus(data.id, "reviewed");
    if (!suggestion) return { ok: false, error: "No suggestion with that id" };
    if (!ok) return { ok: false, error: "Could not update the suggestion" };

    const queue = await store.readBossQueue();
    // Forwarding twice must not create a second decision for the Boss.
    if (!queue.some((s) => s.id === suggestion.id)) {
      queue.unshift({ ...suggestion, status: "pending" });
      const written = await store.writeBossQueue(queue);
      if (!written) return { ok: false, error: "Could not write to the Boss queue" };
    }
    return { ok: true };
  });

export const loadBossQueue = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ suggestions: CEOSuggestion[] }> => {
    await requireExecutive();
    const { readBossQueue } = await import("./store.server");
    const rows = await readBossQueue();
    return {
      suggestions: rows
        .filter((s) => s.status === "pending")
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    };
  },
);

/** Approve or reject a queued suggestion. Recorded in both places. */
export const decideSuggestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1).max(120),
        decision: z.enum(["approved", "rejected"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    await requireExecutive();
    const store = await import("./store.server");

    const queue = await store.readBossQueue();
    const next = queue.map((s) => (s.id === data.id ? { ...s, status: data.decision } : s));
    const inQueue = queue.some((s) => s.id === data.id);

    const [queueWritten, { ok: statusWritten }] = await Promise.all([
      inQueue ? store.writeBossQueue(next) : Promise.resolve(true),
      store.setSuggestionStatus(data.id, data.decision),
    ]);

    if (!queueWritten || !statusWritten) {
      return { ok: false, error: "The decision could not be saved" };
    }
    return { ok: true };
  });

/**
 * Record a new suggestion.
 *
 * Nothing in the product generates these automatically yet — no model is wired
 * to the module — so this exists for the point at which one is, and for an
 * executive adding an item by hand. It is a real write either way.
 */
export const createSuggestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        type: z.enum(["growth", "risk", "cost", "efficiency", "product", "compliance"]),
        title: z.string().min(3).max(160),
        description: z.string().min(3).max(2000),
        confidence: z.number().int().min(0).max(100),
        impact: z.enum(["high", "medium", "low"]),
        impactArea: z.string().min(2).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; id?: string; error?: string }> => {
    await requireExecutive();
    const store = await import("./store.server");

    const suggestion: CEOSuggestion = {
      ...data,
      id: `sug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      createdAt: new Date().toISOString(),
      source: "AI-CEO",
    };

    const rows = await store.readSuggestions();
    const ok = await store.writeSuggestions([suggestion, ...rows]);
    return ok ? { ok, id: suggestion.id } : { ok, error: "Could not save the suggestion" };
  });
