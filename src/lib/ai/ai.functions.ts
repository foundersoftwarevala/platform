import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

function resolveSupabaseEnv() {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const env = typeof process !== "undefined" ? process.env : undefined;
  return {
    url: viteEnv?.VITE_SUPABASE_URL ?? env?.SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
    key: viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ?? env?.SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}

function serverClient() {
  const { url, key } = resolveSupabaseEnv();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } });
}

/*
 * The Vala AI stores this module reads and writes - ai_projects, ai_logs,
 * ai_credits, ai_credit_transactions, ai_issues, ai_settings, ai_snapshots,
 * ai_lock_state, ai_execution_logs, and a prompt history in ai_prompts - were
 * never created on this database. (ai_prompts exists, but it is the prompt
 * library: key, name, prompt, model - not a history of exchanges.) Nothing else
 * on the platform holds these records, so they are not substituted here.
 *
 * Every read therefore checks the database's answer: a failed read returns the
 * empty, non-live ("seed") shape with `available: false` and the reason, never
 * `source: "postgres"` with nothing behind it. Every write throws when the row
 * was not written, so the screen's own error handling reports it instead of a
 * success that recorded nothing. The lock fails closed: when its state cannot
 * be read, the lock reads as armed.
 */
function unavailable<T>(table: string, reason: string, data: T) {
  console.error(`[vala-ai] ${table} unavailable: ${reason}`);
  return { source: "seed", data, available: false, reason: `${table}: ${reason}` } as any;
}

function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const EMPTY_CREDITS = { balance: 0, todayUsage: 0, monthUsage: 0, runwayDays: 0, lowBalanceThreshold: 0, transactions: [], usage: [] };

export const getAiProjects = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try {
    const { data, error } = await sb.from("ai_projects").select("*").limit(100);
    if (error) return unavailable("ai_projects", error.message, []);
    return { source: "postgres", data };
  } catch (e) {
    return unavailable("ai_projects", failure(e), []);
  }
});

export const getAiPrompts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data, error } = await sb.from("ai_prompts").select("*").order("createdAt", { ascending: false }).limit(200); if (error) return unavailable("ai_prompts", error.message, []); return { source: "postgres", data }; } catch (e) { return unavailable("ai_prompts", failure(e), []); }
});

export const getAiLogs = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data, error } = await sb.from("ai_logs").select("*").order("createdAt", { ascending: false }).limit(500); if (error) return unavailable("ai_logs", error.message, []); return { source: "postgres", data }; } catch (e) { return unavailable("ai_logs", failure(e), []); }
});

export const getAiModels = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data, error } = await sb.from("ai_models").select("*").limit(100); if (error) return unavailable("ai_models", error.message, []); return { source: "postgres", data }; } catch (e) { return unavailable("ai_models", failure(e), []); }
});

export const getAiCredits = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: EMPTY_CREDITS } as any;
  try {
    const { data: balance, error: balanceError } = await sb.from("ai_credits").select("*").limit(1).maybeSingle();
    if (balanceError) return unavailable("ai_credits", balanceError.message, EMPTY_CREDITS);
    const { data: transactions, error: txError } = await sb.from("ai_credit_transactions").select("*").order("createdAt", { ascending: false }).limit(50);
    if (txError) return unavailable("ai_credit_transactions", txError.message, EMPTY_CREDITS);
    return { source: "postgres", data: { ...(balance ?? {}), transactions: transactions ?? [], usage: [] } };
  } catch (e) { return unavailable("ai_credits", failure(e), EMPTY_CREDITS); }
});

export const getAiIssues = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data, error } = await sb.from("ai_issues").select("*").order("count", { ascending: false }).limit(200); if (error) return unavailable("ai_issues", error.message, []); return { source: "postgres", data }; } catch (e) { return unavailable("ai_issues", failure(e), []); }
});

export const getAiSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data, error } = await sb.from("ai_settings").select("*").limit(100); if (error) return unavailable("ai_settings", error.message, []); return { source: "postgres", data }; } catch (e) { return unavailable("ai_settings", failure(e), []); }
});

export const getAiSnapshots = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data, error } = await sb.from("ai_snapshots").select("*").order("createdAt", { ascending: false }).limit(200); if (error) return unavailable("ai_snapshots", error.message, []); return { source: "postgres", data }; } catch (e) { return unavailable("ai_snapshots", failure(e), []); }
});

export const getAiLockState = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { data: { locked: true, reason: "lock not configured" } } as any;
  try {
    const { data, error } = await sb.from("ai_lock_state").select("*").limit(1).maybeSingle();
    if (error) {
      console.error(`[vala-ai] ai_lock_state unavailable: ${error.message}`);
      return { data: { locked: true, reason: "Lock state unavailable - the lock store does not exist on this database, so the lock stays armed" }, available: false } as any;
    }
    return { data };
  } catch { return { data: { locked: true, reason: "error" } } as any; }
});

export const updateAiLockState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ locked: z.boolean(), reason: z.string().optional() }).parse(input))
  .handler(async ({ data }) => {
    const sb = serverClient();
    if (!sb) throw new Error("Lock state cannot be changed: Supabase is not configured.");
    const { data: row, error } = await sb.from("ai_lock_state").upsert({ id: "singleton", locked: data.locked, reason: data.reason, updatedAt: new Date().toISOString() }).select().maybeSingle();
    if (error) throw new Error(`Lock state was not changed: ${error.message}`);
    return { ok: true, data: row } as any;
  });

export const logAiExecution = createServerFn({ method: "POST" })
  .inputValidator((v) => z.object({ command: z.string().min(1), status: z.enum(["success", "error", "warning"]), durationMs: z.number().int().nonnegative(), projectTitle: z.string().nullable().optional() }).parse(v ?? {}))
  .handler(async ({ data }) => {
    const sb = serverClient();
    if (!sb) throw new Error("Execution was not recorded: Supabase is not configured.");
    const { data: row, error } = await sb.from("ai_execution_logs").insert({ command: data.command, status: data.status, durationMs: data.durationMs, projectTitle: data.projectTitle, createdAt: new Date().toISOString() }).select().maybeSingle();
    if (error) throw new Error(`Execution was not recorded: ${error.message}`);
    return { ok: true, data: row };
  });

export const saveAiPrompt = createServerFn({ method: "POST" })
  .inputValidator((v) => z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1), language: z.string(), model: z.string(), tokens: z.number().int().nonnegative(), projectTitle: z.string().nullable().optional() }).parse(v ?? {}))
  .handler(async ({ data }) => {
    const sb = serverClient();
    if (!sb) throw new Error("Prompt was not saved: Supabase is not configured.");
    const { data: row, error } = await sb.from("ai_prompts").insert({ role: data.role, content: data.content, language: data.language, model: data.model, tokens: data.tokens, projectTitle: data.projectTitle, createdAt: new Date().toISOString() }).select().maybeSingle();
    if (error) throw new Error(`Prompt was not saved: ${error.message}`);
    return { ok: true, data: row };
  });
