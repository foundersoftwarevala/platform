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

export const getAiProjects = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try {
    const { data } = await sb.from("ai_projects").select("*").limit(100);
    return { source: "postgres", data };
  } catch (e) {
    return { source: "seed", data: [] } as any;
  }
});

export const getAiPrompts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data } = await sb.from("ai_prompts").select("*").order("createdAt", { ascending: false }).limit(200); return { source: "postgres", data }; } catch { return { source: "seed", data: [] } as any; }
});

export const getAiLogs = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data } = await sb.from("ai_logs").select("*").order("createdAt", { ascending: false }).limit(500); return { source: "postgres", data }; } catch { return { source: "seed", data: [] } as any; }
});

export const getAiModels = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data } = await sb.from("ai_models").select("*").limit(100); return { source: "postgres", data }; } catch { return { source: "seed", data: [] } as any; }
});

export const getAiCredits = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: { balance: 0, todayUsage: 0, monthUsage: 0, runwayDays: 0, lowBalanceThreshold: 0, transactions: [], usage: [] } } as any;
  try {
    const { data: balance } = await sb.from("ai_credits").select("*").limit(1).maybeSingle();
    const { data: transactions } = await sb.from("ai_credit_transactions").select("*").order("createdAt", { ascending: false }).limit(50);
    return { source: "postgres", data: { ...(balance ?? {}), transactions: transactions ?? [], usage: [] } };
  } catch { return { source: "seed", data: { balance: 0, todayUsage: 0, monthUsage: 0, runwayDays: 0, lowBalanceThreshold: 0, transactions: [], usage: [] } } as any; }
});

export const getAiIssues = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data } = await sb.from("ai_issues").select("*").order("count", { ascending: false }).limit(200); return { source: "postgres", data }; } catch { return { source: "seed", data: [] } as any; }
});

export const getAiSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data } = await sb.from("ai_settings").select("*").limit(100); return { source: "postgres", data }; } catch { return { source: "seed", data: [] } as any; }
});

export const getAiSnapshots = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { source: "seed", data: [] } as any;
  try { const { data } = await sb.from("ai_snapshots").select("*").order("createdAt", { ascending: false }).limit(200); return { source: "postgres", data }; } catch { return { source: "seed", data: [] } as any; }
});

export const getAiLockState = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  if (!sb) return { data: { locked: true, reason: "lock not configured" } } as any;
  try { const { data } = await sb.from("ai_lock_state").select("*").limit(1).maybeSingle(); return { data }; } catch { return { data: { locked: true, reason: "error" } } as any; }
});

export const updateAiLockState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ locked: z.boolean(), reason: z.string().optional() }).parse(input))
  .handler(async ({ data }) => {
    const sb = serverClient();
    if (!sb) return { ok: false, error: "supabase not configured" } as any;
    try { await sb.from("ai_lock_state").upsert({ id: "singleton", locked: data.locked, reason: data.reason, updatedAt: new Date().toISOString() }); return { ok: true }; } catch (e) { return { ok: false, error: String(e) }; }
  });

export const logAiExecution = createServerFn({ method: "POST" })
  .inputValidator((v) => z.object({ command: z.string().min(1), status: z.enum(["success", "error", "warning"]), durationMs: z.number().int().nonnegative(), projectTitle: z.string().nullable().optional() }).parse(v ?? {}))
  .handler(async ({ data }) => {
    const sb = serverClient();
    if (!sb) return { ok: false, error: "supabase not configured" } as any;
    try { const { data: row } = await sb.from("ai_execution_logs").insert({ command: data.command, status: data.status, durationMs: data.durationMs, projectTitle: data.projectTitle, createdAt: new Date().toISOString() }).select().maybeSingle(); return { ok: true, data: row }; } catch (e) { return { ok: false, error: String(e) }; }
  });

export const saveAiPrompt = createServerFn({ method: "POST" })
  .inputValidator((v) => z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1), language: z.string(), model: z.string(), tokens: z.number().int().nonnegative(), projectTitle: z.string().nullable().optional() }).parse(v ?? {}))
  .handler(async ({ data }) => {
    const sb = serverClient();
    if (!sb) return { ok: false, error: "supabase not configured" } as any;
    try { const { data: row } = await sb.from("ai_prompts").insert({ role: data.role, content: data.content, language: data.language, model: data.model, tokens: data.tokens, projectTitle: data.projectTitle, createdAt: new Date().toISOString() }).select().maybeSingle(); return { ok: true, data: row }; } catch (e) { return { ok: false, error: String(e) }; }
  });
