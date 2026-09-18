import { aiComplete } from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { TranslationEngine } from "./engine/engine";
import { createAiApiManagerProvider } from "./engine/providers/ai-api-manager";
import { createOwnedEngineProvider } from "./engine/providers/owned-engine";
import type { TranslationProvider } from "./engine/types";
import type { GlossaryTerm } from "./glossary";
import { ANONYMOUS_DAILY_ENGINE_CHARS, TIER_LIMITS, type CallerTier } from "./limits";
import {
  runTranslationPipeline,
  type GlossaryStore,
  type MemoryEntry,
  type MemoryRecord,
  type MemoryStatus,
  type PipelineRequest,
  type PipelineResult,
  type TranslationMemoryStore,
} from "./pipeline";
import { UI_DICTIONARY } from "./ui-dictionary";

/**
 * Server side of the translation system: the pipeline wired to the database
 * and to the configured providers. Server-only; it holds the service-role
 * client and must never be imported from browser code.
 *
 * Environment:
 *   TRANSLATE_PROVIDER_URL      the platform's own translation service
 *   TRANSLATE_PROVIDER_TOKEN    bearer token for it (optional)
 *   TRANSLATION_PROVIDER_ORDER  comma list, default "owned-engine,ai-api-manager"
 *   TRANSLATION_ALLOW_EXTERNAL  "true" also allows the external AI API Manager adapter;
 *                               by default only the platform's own engine is used
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export function db(): UntypedDb | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return supabaseAdmin as UntypedDb;
}

export function log(message: string, detail?: unknown) {
  console.error(message, detail ?? "");
}

/* ------------------------------------------------------------------ engine */

let engine: TranslationEngine | null = null;

export function getTranslationEngine(): TranslationEngine {
  if (engine) return engine;
  const available: Record<string, TranslationProvider> = {
    "owned-engine": createOwnedEngineProvider({
      endpoint: process.env.TRANSLATE_PROVIDER_URL,
      token: process.env.TRANSLATE_PROVIDER_TOKEN,
      ...(process.env.TRANSLATE_PROVIDER_TIMEOUT_MS
        ? { timeoutMs: Number(process.env.TRANSLATE_PROVIDER_TIMEOUT_MS) }
        : {}),
    }),
    "ai-api-manager": createAiApiManagerProvider({ complete: aiComplete }),
  };
  const order = (process.env.TRANSLATION_PROVIDER_ORDER ?? "owned-engine,ai-api-manager")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id in available);
  engine = new TranslationEngine(
    order.map((id) => available[id]!),
    { allowExternal: process.env.TRANSLATION_ALLOW_EXTERNAL?.trim().toLowerCase() === "true" },
  );
  return engine;
}

/* ------------------------------------------------------------------ memory */

const STATUS_RANK: Record<MemoryStatus, number> = {
  verified: 5,
  rejected: 4,
  needs_review: 3,
  machine: 2,
  stale: 1,
  legacy: 0,
};

export function createSupabaseMemoryStore(client: UntypedDb): TranslationMemoryStore {
  return {
    async lookup({ sourceLanguage, targetLanguage, sourceHashes }) {
      const found = new Map<string, MemoryEntry>();
      if (sourceHashes.length === 0) return found;
      const { data, error } = await client
        .from("marketplace_translations")
        .select(
          "source_hash, context_hash, translated_text, status, quality_score, version, engine",
        )
        .eq("source_language", sourceLanguage)
        .eq("target_language", targetLanguage)
        .in("source_hash", sourceHashes)
        .in("status", ["verified", "machine", "needs_review", "rejected"]);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const entry: MemoryEntry = {
          sourceHash: String(row.source_hash),
          contextHash: String(row.context_hash),
          translatedText: String(row.translated_text ?? ""),
          status: row.status as MemoryStatus,
          qualityScore: row.quality_score === null ? null : Number(row.quality_score),
          version: Number(row.version ?? 1),
          engine: (row.engine as string | null) ?? null,
        };
        const key = `${entry.sourceHash}:${entry.contextHash}`;
        const current = found.get(key);
        if (!current || STATUS_RANK[entry.status] > STATUS_RANK[current.status])
          found.set(key, entry);
      }
      return found;
    },
    async save(records: MemoryRecord[]) {
      const rows = records.map((record) => ({
        source_hash: record.sourceHash,
        source_language: record.sourceLanguage,
        target_language: record.targetLanguage,
        locale: record.targetLanguage,
        context_hash: record.contextHash,
        namespace: record.namespace,
        context: record.context,
        translation_key: record.translationKey,
        source_text: record.sourceText,
        translated_text: record.translatedText,
        status: record.status,
        quality_score: record.qualityScore,
        quality_flags: record.qualityFlags,
        engine: record.engine,
        engine_version: record.engineVersion,
        provider: record.engine,
        model: record.engineVersion,
        metadata: { provider_kind: record.providerKind },
      }));
      const { error } = await client
        .from("marketplace_translations")
        .upsert(rows, { onConflict: "source_hash,source_language,target_language,context_hash" });
      if (error) throw new Error(error.message);
    },
  };
}

export function createSupabaseGlossaryStore(client: UntypedDb): GlossaryStore {
  return {
    async load({ source, target }) {
      const { data, error } = await client
        .from("i18n_glossary_terms")
        .select(
          "source_term, target_term, source_language, target_language, rule, case_sensitive, namespace",
        )
        .eq("status", "approved")
        .eq("source_language", source)
        .or(`target_language.is.null,target_language.eq.${target}`);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((row): GlossaryTerm => ({
        sourceTerm: String(row.source_term),
        targetTerm: (row.target_term as string | null) ?? null,
        sourceLanguage: String(row.source_language),
        targetLanguage: (row.target_language as string | null) ?? null,
        rule: row.rule as GlossaryTerm["rule"],
        caseSensitive: Boolean(row.case_sensitive),
        namespace: (row.namespace as string | null) ?? null,
      }));
    },
  };
}

/* --------------------------------------------------------------- overrides */

const OVERRIDE_TTL_MS = 5 * 60_000;
let overrides: { at: number; disabled: Set<string> } | null = null;

/** Languages an operator switched off in i18n_languages (cached briefly). */
export function invalidateLanguageOverrides() {
  overrides = null;
}

export async function disabledLanguages(client: UntypedDb | null): Promise<Set<string>> {
  if (!client) return new Set();
  if (overrides && Date.now() - overrides.at < OVERRIDE_TTL_MS) return overrides.disabled;
  try {
    const { data, error } = await client.from("i18n_languages").select("code").eq("enabled", false);
    if (error) throw new Error(error.message);
    overrides = {
      at: Date.now(),
      disabled: new Set(((data ?? []) as { code: string }[]).map((r) => r.code)),
    };
  } catch (error) {
    log("[i18n] language overrides unavailable", error);
    overrides = { at: Date.now(), disabled: overrides?.disabled ?? new Set() };
  }
  return overrides.disabled;
}

/* ------------------------------------------------------------------- quota */

const localWindows = new Map<string, { window: number; units: number }>();

/** The same quota as i18n_consume_quota, kept in this process only. */
function localQuota(subject: string, units: number, limit: number, windowSeconds: number): boolean {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `${subject}:${windowSeconds}`;
  const current = localWindows.get(key);
  const used = (current && current.window === window ? current.units : 0) + units;
  if (localWindows.size > 20_000) localWindows.clear();
  localWindows.set(key, { window, units: used });
  return used <= limit;
}

async function consumeQuota(
  client: UntypedDb,
  subject: string,
  units: number,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await client.rpc("i18n_consume_quota", {
    p_subject: subject,
    p_units: units,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/* ------------------------------------------------------------------ caller */

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Caller = {
  tier: CallerTier;
  /** Quota subject: a user id or a hashed address. Never logged. */
  subject: string;
  userId: string | null;
};

/**
 * Who is asking. A missing or invalid token is an anonymous caller, not an
 * error: the storefront translates for visitors too.
 */
export async function resolveCaller(
  authorization: string | null,
  address: string,
  internalToken?: string | null,
): Promise<Caller> {
  // A caller holding INTERNAL_API_TOKEN is the platform itself (schedulers,
  // operator scripts). Same trust level as src/lib/auth/internal-guard.ts.
  const expected = process.env.INTERNAL_API_TOKEN?.trim();
  const presented = internalToken?.trim();
  if (
    expected &&
    presented &&
    expected.length === presented.length &&
    timingSafeEqual(expected, presented)
  ) {
    return { tier: "operator", subject: "internal:token", userId: null };
  }
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const client = db();
  if (token && client) {
    try {
      const { data, error } = await client.auth.getUser(token);
      const user = data?.user;
      if (!error && user) {
        const { data: roles, error: rolesError } = await client
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["admin", "boss"]);
        const operator = !rolesError && Array.isArray(roles) && roles.length > 0;
        return {
          tier: operator ? "operator" : "user",
          subject: `user:${user.id}`,
          userId: user.id,
        };
      }
    } catch (error) {
      log("[i18n] caller lookup failed", error);
    }
  }
  const { sourceHash } = await import("./hash");
  return { tier: "anonymous", subject: `anon:${await sourceHash(address)}`, userId: null };
}

/* ----------------------------------------------------------------- service */

const CATALOGUE = new Set(Object.keys(UI_DICTIONARY.en ?? {}));

/** Whether a source string is part of the interface catalogue. */
export function isCatalogueText(text: string): boolean {
  return CATALOGUE.has(text);
}

/**
 * Translate on behalf of a caller: the tier decides what may be written to
 * shared memory and how much engine work may be spent.
 */
export async function translateForCaller(
  request: Omit<PipelineRequest, "mayPersist">,
  caller: Caller,
): Promise<PipelineResult> {
  const client = db();
  const disabled = await disabledLanguages(client);
  const limits = TIER_LIMITS[caller.tier];

  const quota = async (units: number) => {
    if (!client) {
      if (!localQuota(caller.subject, units, limits.engineCharsPerHour, 3600)) return false;
      return (
        caller.tier !== "anonymous" ||
        localQuota("anon:all", units, ANONYMOUS_DAILY_ENGINE_CHARS, 86_400)
      );
    }
    try {
      const own = await consumeQuota(
        client,
        caller.subject,
        units,
        limits.engineCharsPerHour,
        3600,
      );
      if (!own) return false;
      if (caller.tier === "anonymous") {
        return await consumeQuota(client, "anon:all", units, ANONYMOUS_DAILY_ENGINE_CHARS, 86_400);
      }
      return true;
    } catch (error) {
      // Without the quota table there is no cross-instance cost control; this
      // instance still enforces the same limits on its own.
      log("[i18n] quota table unavailable, using the per-instance limit", error);
      if (!localQuota(caller.subject, units, limits.engineCharsPerHour, 3600)) return false;
      if (caller.tier === "anonymous") {
        return localQuota("anon:all", units, ANONYMOUS_DAILY_ENGINE_CHARS, 86_400);
      }
      return true;
    }
  };

  return runTranslationPipeline(
    {
      ...request,
      mayPersist:
        caller.tier === "operator"
          ? undefined
          : (text) => (request.namespace ?? "ui") === "ui" && isCatalogueText(text),
    },
    {
      engine: getTranslationEngine(),
      memory: client ? createSupabaseMemoryStore(client) : null,
      glossary: client ? createSupabaseGlossaryStore(client) : null,
      quota,
      isLanguageEnabled: (code) => !disabled.has(code),
      log,
    },
  );
}
