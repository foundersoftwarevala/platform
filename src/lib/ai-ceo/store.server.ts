import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import type { CEOSuggestion } from "./types";

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
  const [row] = await withVpsPublicDatabase((tx) => tx<{ value: string | null }[]>`
    select value from public.system_settings where key = ${key} limit 1
  `);
  if (!row?.value) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    console.error(`[ai-ceo] ${key} does not contain valid JSON; using the fallback`);
    return fallback;
  }
}

async function writeKey(key: string, value: unknown): Promise<boolean> {
  try {
    const [row] = await withVpsPublicDatabase((tx) => tx<{ key: string }[]>`
      insert into public.system_settings (key, label, value, value_type, category, updated_at)
      values (${key}, ${LABELS[key] ?? key}, ${JSON.stringify(value)}, 'json', ${CATEGORY}, now())
      on conflict (key) do update set
        label = excluded.label,
        value = excluded.value,
        value_type = excluded.value_type,
        category = excluded.category,
        updated_at = excluded.updated_at
      returning key
    `);
    return Boolean(row?.key);
  } catch (error) {
    console.error(`[ai-ceo] could not write ${key}:`, error);
    return false;
  }
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

export async function setSuggestionStatus(
  id: string,
  status: CEOSuggestion["status"],
): Promise<{ ok: boolean; suggestion: CEOSuggestion | null }> {
  const rows = await readSuggestions();
  const found = rows.find((suggestion) => suggestion.id === id) ?? null;
  if (!found) return { ok: false, suggestion: null };

  const next = rows.map((suggestion) => (suggestion.id === id ? { ...suggestion, status } : suggestion));
  const ok = await writeSuggestions(next);
  return { ok, suggestion: ok ? { ...found, status } : found };
}
