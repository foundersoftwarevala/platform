import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type { CEOSuggestion } from "./types";

/**
 * Where the AI CEO module keeps the state it owns.
 *
 * The imported module pointed at an external `AIRA_API_URL` that was never
 * stood up, and every call degraded silently to in-memory seed data — so a
 * decision the Boss made vanished on reload. There is no way to run DDL from
 * this environment (no SQL RPC, no database password), so the six tables its
 * Prisma file documents could not be created. `system_settings` is a real,
 * existing key/value table with a `value_type` column, which is precisely what
 * it is for, and rows written here persist like any other row.
 *
 * Three keys, all under category `ai_ceo`:
 *   ai_ceo.suggestions    the suggestion set and each one's current status
 *   ai_ceo.boss_queue     suggestions forwarded to the Boss for a decision
 *   ai_ceo.last_refresh   when the dashboard last recomputed
 *
 * Nothing else is stored: the metrics, observations, activity feed and decision
 * history are all measured from the platform's own tables on every request.
 *
 * If the documented tables are created later, only this file changes.
 */

const CATEGORY = "ai_ceo";

export const KEYS = {
  suggestions: "ai_ceo.suggestions",
  bossQueue: "ai_ceo.boss_queue",
  lastRefresh: "ai_ceo.last_refresh",
} as const;

const LABELS: Record<string, string> = {
  [KEYS.suggestions]: "AI CEO suggestions",
  [KEYS.bossQueue]: "AI CEO boss review queue",
  [KEYS.lastRefresh]: "AI CEO last refresh",
};

async function readKey<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data?.value) return fallback;
  try {
    return JSON.parse(data.value as string) as T;
  } catch {
    // A hand-edited row should not take the dashboard down with it.
    console.error(`[ai-ceo] ${key} does not contain valid JSON; using the fallback`);
    return fallback;
  }
}

async function writeKey(key: string, value: unknown): Promise<boolean> {
  const row = {
    key,
    label: LABELS[key] ?? key,
    value: JSON.stringify(value),
    value_type: "json",
    category: CATEGORY,
    updated_at: new Date().toISOString(),
  };

  // upsert on the key, which is the table's natural identifier
  const { error } = await supabaseAdmin
    .from("system_settings")
    .upsert(row as never, { onConflict: "key" });

  if (error) {
    console.error(`[ai-ceo] could not write ${key}: ${error.message}`);
    return false;
  }
  return true;
}

export async function readSuggestions(): Promise<CEOSuggestion[]> {
  return readKey<CEOSuggestion[]>(KEYS.suggestions, []);
}

export async function writeSuggestions(rows: CEOSuggestion[]): Promise<boolean> {
  return writeKey(KEYS.suggestions, rows);
}

export async function readBossQueue(): Promise<CEOSuggestion[]> {
  return readKey<CEOSuggestion[]>(KEYS.bossQueue, []);
}

export async function writeBossQueue(rows: CEOSuggestion[]): Promise<boolean> {
  return writeKey(KEYS.bossQueue, rows);
}

export async function readLastRefresh(): Promise<string | null> {
  const row = await readKey<{ at: string | null }>(KEYS.lastRefresh, { at: null });
  return row.at ?? null;
}

export async function writeLastRefresh(at: string): Promise<boolean> {
  return writeKey(KEYS.lastRefresh, { at });
}

/**
 * Change one suggestion's status in place.
 *
 * Read-modify-write on a single JSON row is not safe against two operators
 * acting at the same instant. The dashboard has one Boss and decisions are
 * rare, so the exposure is small — but it is real, and it goes away when the
 * documented `ceo_suggestions` table exists and each row can be updated on its
 * own. Recorded here rather than left to be discovered.
 */
export async function setSuggestionStatus(
  id: string,
  status: CEOSuggestion["status"],
): Promise<{ ok: boolean; suggestion: CEOSuggestion | null }> {
  const rows = await readSuggestions();
  const found = rows.find((s) => s.id === id) ?? null;
  if (!found) return { ok: false, suggestion: null };

  const next = rows.map((s) => (s.id === id ? { ...s, status } : s));
  const ok = await writeSuggestions(next);
  return { ok, suggestion: ok ? { ...found, status } : found };
}
