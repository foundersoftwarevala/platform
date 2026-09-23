import { aiComplete } from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { TranslationEngine } from "./engine/engine";
import { createAiApiManagerProvider } from "./engine/providers/ai-api-manager";
import { createOwnedEngineProvider } from "./engine/providers/owned-engine";
import type { TranslationProvider } from "./engine/types";
import type { GlossaryTerm } from "./glossary";
import { sourceHash } from "./hash";
import { SingleFlight, TtlCache } from "./hot-cache";
import { ANONYMOUS_DAILY_ENGINE_CHARS, TIER_LIMITS, type CallerTier } from "./limits";
import { count, observe, type CacheStats } from "./metrics.server";
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
import { allMessages } from "./messages";
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

/** The provider with its calls measured (engine latency, outcomes, segments). */
function timed(provider: TranslationProvider): TranslationProvider {
  return {
    ...provider,
    isConfigured: () => provider.isConfigured(),
    supports: (...args: Parameters<TranslationProvider["supports"]>) => provider.supports(...args),
    async translate(request) {
      const started = performance.now();
      try {
        const response = await provider.translate(request);
        count("engine.ok");
        count("engine.segments", request.segments.length);
        return response;
      } catch (error) {
        count("engine.error");
        throw error;
      } finally {
        observe(`engine.${request.mode}`, performance.now() - started);
      }
    },
  };
}

let engine: TranslationEngine | null = null;

export function getTranslationEngine(): TranslationEngine {
  if (engine) return engine;
  const available: Record<string, TranslationProvider> = {
    "owned-engine": timed(
      createOwnedEngineProvider({
        endpoint: process.env.TRANSLATE_PROVIDER_URL,
        token: process.env.TRANSLATE_PROVIDER_TOKEN,
        ...(process.env.TRANSLATE_PROVIDER_TIMEOUT_MS
          ? { timeoutMs: Number(process.env.TRANSLATE_PROVIDER_TIMEOUT_MS) }
          : {}),
      }),
    ),
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

/*
 * Translation memory, glossary and callers are read on every request, and the
 * database is a network round trip away (about 280 ms from the production
 * host). Measured before these caches: a page's batch of 36 strings that were
 * all in memory took about 0.9 s and the endpoint topped out near 10 requests
 * a second. The caches below keep that path in the process; the database is
 * read when something is not known yet and written as before.
 *
 * Freshness: an engine result saved here is written into the cache as it is
 * stored (and dropped again if storing fails); reviews, glossary edits and
 * language switches made through the Language
 * Manager clear the caches (invalidateTranslationCaches). Entries otherwise
 * expire after the TTLs below.
 */
const MEMORY_TTL_MS = 10 * 60_000;
/** A string memory does not hold yet is looked up again after this long. */
const MEMORY_ABSENT_TTL_MS = 60_000;
const memoryCache = new TtlCache<Map<string, MemoryEntry>>(200_000);
const memoryFlight = new SingleFlight<void>();

const GLOSSARY_TTL_MS = 5 * 60_000;
const glossaryCache = new TtlCache<GlossaryTerm[]>(1_000);
const glossaryFlight = new SingleFlight<GlossaryTerm[]>();

function memoryKey(source: string, target: string, hash: string) {
  return `${source}|${target}|${hash}`;
}

async function fetchMemoryRows(
  client: UntypedDb,
  sourceLanguage: string,
  targetLanguage: string,
  hashes: string[],
): Promise<void> {
  const started = performance.now();
  const { data, error } = await client
    .from("marketplace_translations")
    .select("source_hash, context_hash, translated_text, status, quality_score, version, engine")
    .eq("source_language", sourceLanguage)
    .eq("target_language", targetLanguage)
    .in("source_hash", hashes)
    .in("status", ["verified", "machine", "needs_review", "rejected"]);
  observe("db.memory_lookup", performance.now() - started);
  if (error) {
    count("db.error");
    throw new Error(error.message);
  }
  const byHash = new Map<string, Map<string, MemoryEntry>>(hashes.map((h) => [h, new Map()]));
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
    const contexts = byHash.get(entry.sourceHash);
    if (!contexts) continue;
    const current = contexts.get(entry.contextHash);
    if (!current || STATUS_RANK[entry.status] > STATUS_RANK[current.status]) {
      contexts.set(entry.contextHash, entry);
    }
  }
  for (const [hash, contexts] of byHash) {
    memoryCache.set(
      memoryKey(sourceLanguage, targetLanguage, hash),
      contexts,
      contexts.size ? MEMORY_TTL_MS : MEMORY_ABSENT_TTL_MS,
    );
  }
}

export function createSupabaseMemoryStore(client: UntypedDb): TranslationMemoryStore {
  return {
    async lookup({ sourceLanguage, targetLanguage, sourceHashes }) {
      const found = new Map<string, MemoryEntry>();
      if (sourceHashes.length === 0) return found;
      const collect = (hash: string) => {
        const contexts = memoryCache.get(memoryKey(sourceLanguage, targetLanguage, hash));
        if (!contexts) return false;
        for (const [contextHash, entry] of contexts) found.set(`${hash}:${contextHash}`, entry);
        return true;
      };
      const missing = [...new Set(sourceHashes)].filter((hash) => !collect(hash)).sort();
      if (missing.length > 0) {
        // Visitors of the same page in the same language ask for the same
        // batch at the same time; they share one read.
        await memoryFlight.run(`${sourceLanguage}|${targetLanguage}|${missing.join(",")}`, () =>
          fetchMemoryRows(client, sourceLanguage, targetLanguage, missing),
        );
        for (const hash of missing) collect(hash);
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
        metadata: { provider_kind: record.providerKind, mode: record.mode ?? null },
      }));
      // Write through: the next request for these strings is answered from
      // the process at once, instead of reading them back (or, while "not
      // in memory" is still cached, sending them to the engine again).
      for (const record of records) {
        const key = memoryKey(record.sourceLanguage, record.targetLanguage, record.sourceHash);
        const contexts = new Map(memoryCache.peek(key) ?? []);
        const current = contexts.get(record.contextHash);
        if (!current || STATUS_RANK[record.status] >= STATUS_RANK[current.status]) {
          contexts.set(record.contextHash, {
            sourceHash: record.sourceHash,
            contextHash: record.contextHash,
            translatedText: record.translatedText,
            status: record.status,
            qualityScore: record.qualityScore,
            version: current ? current.version + 1 : 1,
            engine: record.engine,
          });
        }
        memoryCache.set(key, contexts, MEMORY_TTL_MS);
      }
      const started = performance.now();
      const { error } = await client
        .from("marketplace_translations")
        .upsert(rows, { onConflict: "source_hash,source_language,target_language,context_hash" });
      observe("db.memory_save", performance.now() - started);
      if (error) {
        // Not stored: forget it here too, so the process and the database agree.
        for (const record of records) {
          memoryCache.delete(
            memoryKey(record.sourceLanguage, record.targetLanguage, record.sourceHash),
          );
        }
        count("db.error");
        throw new Error(error.message);
      }
    },
  };
}

export function createSupabaseGlossaryStore(client: UntypedDb): GlossaryStore {
  return {
    async load({ source, target }) {
      const key = `${source}|${target}`;
      const cached = glossaryCache.get(key);
      if (cached) return cached;
      return glossaryFlight.run(key, async () => {
        const { data, error } = await client
          .from("i18n_glossary_terms")
          .select(
            "source_term, target_term, source_language, target_language, rule, case_sensitive, namespace",
          )
          .eq("status", "approved")
          .eq("source_language", source)
          .or(`target_language.is.null,target_language.eq.${target}`);
        if (error) {
          count("db.error");
          throw new Error(error.message);
        }
        const terms = ((data ?? []) as Record<string, unknown>[]).map((row): GlossaryTerm => ({
          sourceTerm: String(row.source_term),
          targetTerm: (row.target_term as string | null) ?? null,
          sourceLanguage: String(row.source_language),
          targetLanguage: (row.target_language as string | null) ?? null,
          rule: row.rule as GlossaryTerm["rule"],
          caseSensitive: Boolean(row.case_sensitive),
          namespace: (row.namespace as string | null) ?? null,
        }));
        glossaryCache.set(key, terms, GLOSSARY_TTL_MS);
        return terms;
      });
    },
  };
}

/* ---------------------------------------------------------- language packs */

/** Between context and source text; the browser keys the strings it holds the same way. */
export const PACK_SEPARATOR = String.fromCharCode(1);
const PACK_TTL_MS = 5 * 60_000;
/** Upper bound on strings in one pack; the most recently written come first. */
const PACK_MAX_ENTRIES = 6_000;
const PACK_PAGE = 1_000;

export type LanguagePack = { body: string; etag: string; count: number };

const packCache = new TtlCache<LanguagePack>(400);
const packFlight = new SingleFlight<LanguagePack>();
/** The last pack built per language, served when a rebuild fails (database unreachable). */
const lastGoodPack = new Map<string, LanguagePack>();

/**
 * Every interface string translation memory holds for a language, in one
 * response: the page loads it once instead of asking string by string, and
 * only what it does not contain goes to the translation endpoint. Text comes
 * only from servable rows (machine, verified) of the "ui" namespace - never
 * private namespaces such as chat. Strings held for review or rejected are
 * listed without text under `withheld`, so the page does not keep asking.
 */
export async function languagePack(code: string): Promise<LanguagePack> {
  const cached = packCache.get(code);
  if (cached) return cached;
  return packFlight.run(code, () =>
    buildLanguagePack(code).catch((error: unknown) => {
      const stale = lastGoodPack.get(code);
      if (!stale) throw error;
      count("pack.served_stale");
      log("[i18n] language pack rebuild failed; serving the previous one", error);
      return stale;
    }),
  );
}

async function buildLanguagePack(code: string): Promise<LanguagePack> {
  const client = db();
  const entries: Record<string, string> = {};
  const locked: string[] = [];
  const verified = new Set<string>();
  // Strings memory holds but will not serve (waiting for review or rejected):
  // the page is told, so it does not ask for them on every visit.
  const withheld = new Set<string>();
  if (client) {
    const started = performance.now();
    for (let from = 0; from < PACK_MAX_ENTRIES; from += PACK_PAGE) {
      const { data, error } = await client
        .from("marketplace_translations")
        .select("source_text, context, translated_text, status")
        .eq("source_language", "en")
        .eq("target_language", code)
        .eq("namespace", "ui")
        .in("status", ["machine", "verified", "needs_review", "rejected"])
        .order("updated_at", { ascending: false })
        .range(from, from + PACK_PAGE - 1);
      if (error) {
        count("db.error");
        throw new Error(error.message);
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      for (const row of rows) {
        const key = `${(row.context as string | null) ?? ""}${PACK_SEPARATOR}${String(row.source_text)}`;
        if (row.status === "needs_review" || row.status === "rejected") {
          withheld.add(key);
          continue;
        }
        const text = String(row.translated_text ?? "");
        if (!text) continue;
        if (verified.has(key)) continue;
        if (row.status === "verified") verified.add(key);
        else if (key in entries) continue;
        entries[key] = text;
      }
      if (rows.length < PACK_PAGE) break;
    }
    observe("db.pack_build", performance.now() - started);
    // Brand names that are never translated: a string made only of these is
    // shown as it is, without asking.
    const terms = await createSupabaseGlossaryStore(client).load({
      source: "en",
      target: code,
      namespace: "ui",
    });
    for (const term of terms) {
      if (term.rule === "locked" && !term.targetTerm && !term.namespace)
        locked.push(term.sourceTerm);
    }
  }
  const total = Object.keys(entries).length;
  for (const key of Object.keys(entries)) withheld.delete(key);
  const body = JSON.stringify({
    lang: code,
    count: total,
    entries,
    withheld: [...withheld],
    locked,
  });
  const pack: LanguagePack = {
    body,
    etag: `W/"${(await sourceHash(body)).slice(0, 20)}"`,
    count: total,
  };
  packCache.set(code, pack, PACK_TTL_MS);
  lastGoodPack.set(code, pack);
  count("pack.built");
  return pack;
}

/** Drop cached memory, glossary and packs (after a review, glossary edit or language switch). */
export function invalidateTranslationCaches() {
  memoryCache.deletePrefix("");
  glossaryCache.deletePrefix("");
  packCache.deletePrefix("");
}

export function translationCacheStats(): CacheStats {
  const stats = (c: { size: number; hits: number; misses: number }) => ({
    size: c.size,
    hits: c.hits,
    misses: c.misses,
  });
  return {
    memory: stats(memoryCache),
    glossary: stats(glossaryCache),
    packs: stats(packCache),
    callers: stats(callerCache),
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

// Each window expires when it ends; when full, the least recently used goes
// first, so the shared anonymous budget ("anon:all"), used on every request,
// is never dropped by a crowd of one-off visitors.
const localWindows = new TtlCache<{ window: number; units: number }>(200_000);

/** The same quota as i18n_consume_quota, kept in this process. */
function localQuota(subject: string, units: number, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const window = Math.floor(now / 1000 / windowSeconds);
  const key = `${subject}:${windowSeconds}`;
  const current = localWindows.peek(key, now);
  const used = (current && current.window === window ? current.units : 0) + units;
  const windowEnds = (window + 1) * windowSeconds * 1000;
  localWindows.set(key, { window, units: used }, windowEnds - now, now);
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

/*
 * Usage is written to i18n_request_quota in the background: summed per
 * subject and window, and sent every few seconds, so a burst of requests
 * costs one database call instead of two per request. When the database says
 * a subject is over its limit (usage from before a restart, or from another
 * instance), that subject is refused locally until the window ends.
 */
const QUOTA_FLUSH_MS = 5_000;
const pendingUsage = new Map<
  string,
  { subject: string; units: number; limit: number; windowSeconds: number }
>();
const quotaBlocked = new Map<string, number>(); // subject -> blocked until (ms)
let quotaFlushTimer: ReturnType<typeof setTimeout> | null = null;

function isQuotaBlocked(subject: string): boolean {
  const until = quotaBlocked.get(subject);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  quotaBlocked.delete(subject);
  return false;
}

function recordQuotaUsage(
  client: UntypedDb,
  subject: string,
  units: number,
  limit: number,
  windowSeconds: number,
) {
  const key = `${subject}|${windowSeconds}`;
  const entry = pendingUsage.get(key);
  if (entry) entry.units += units;
  else pendingUsage.set(key, { subject, units, limit, windowSeconds });
  if (quotaFlushTimer) return;
  quotaFlushTimer = setTimeout(() => {
    quotaFlushTimer = null;
    void flushQuotaUsage(client);
  }, QUOTA_FLUSH_MS);
  (quotaFlushTimer as unknown as { unref?: () => void }).unref?.();
}

async function flushQuotaUsage(client: UntypedDb) {
  const batch = [...pendingUsage.values()];
  pendingUsage.clear();
  for (const item of batch) {
    try {
      const allowed = await consumeQuota(
        client,
        item.subject,
        item.units,
        item.limit,
        item.windowSeconds,
      );
      count("quota.flushed");
      if (!allowed) {
        const windowMs = item.windowSeconds * 1000;
        quotaBlocked.set(item.subject, (Math.floor(Date.now() / windowMs) + 1) * windowMs);
        count("quota.blocked");
      }
    } catch (error) {
      count("quota.flush_error");
      log("[i18n] quota usage not recorded", error);
    }
  }
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

/** Checked tokens (keyed by their hash): the caller, or null for a token that did not check out. */
const CALLER_TTL_MS = 60_000;
const callerCache = new TtlCache<Caller | null>(50_000);
const callerFlight = new SingleFlight<Caller | null>();

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
    // A signed-in page sends its token with every batch; checking it costs two
    // database round trips, so the answer is kept for a minute. Tokens that
    // do not check out are remembered too, so a stream of made-up tokens
    // cannot be turned into a stream of auth lookups.
    const key = await sourceHash(token);
    const known = callerCache.get(key);
    if (known !== undefined) {
      if (known) return known;
    } else {
      const resolved = await callerFlight.run(key, async () => {
        let caller: Caller | null = null;
        try {
          const started = performance.now();
          const { data, error } = await client.auth.getUser(token);
          const user = data?.user;
          if (!error && user) {
            const { data: roles, error: rolesError } = await client
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
              .in("role", ["admin", "boss"]);
            const operator = !rolesError && Array.isArray(roles) && roles.length > 0;
            caller = {
              tier: operator ? "operator" : "user",
              subject: `user:${user.id}`,
              userId: user.id,
            };
          }
          observe("db.caller", performance.now() - started);
        } catch (error) {
          log("[i18n] caller lookup failed", error);
          return null; // not cached: the next request tries again
        }
        callerCache.set(key, caller, CALLER_TTL_MS);
        return caller;
      });
      if (resolved) return resolved;
    }
  }
  return { tier: "anonymous", subject: `anon:${await sourceHash(address)}`, userId: null };
}

/* ----------------------------------------------------------------- service */

// The interface catalogue: the dictionary's English wording and the keyed
// messages (src/lib/i18n/messages). Only these are written to shared memory on
// behalf of visitors; anything else a page sends is translated but not kept.
const CATALOGUE = new Set([
  ...Object.keys(UI_DICTIONARY.en ?? {}),
  ...allMessages().map((m) => m.text),
]);

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

  // Decided in this process, so engine work never waits on the database; the
  // usage is recorded there in the background (recordQuotaUsage), and a
  // caller the database finds over its limit is refused here until its
  // window ends.
  const quota = async (units: number) => {
    if (isQuotaBlocked(caller.subject)) return false;
    if (!localQuota(caller.subject, units, limits.engineCharsPerHour, 3600)) return false;
    if (caller.tier === "anonymous") {
      if (isQuotaBlocked("anon:all")) return false;
      if (!localQuota("anon:all", units, ANONYMOUS_DAILY_ENGINE_CHARS, 86_400)) return false;
    }
    if (client) {
      recordQuotaUsage(client, caller.subject, units, limits.engineCharsPerHour, 3600);
      if (caller.tier === "anonymous") {
        recordQuotaUsage(client, "anon:all", units, ANONYMOUS_DAILY_ENGINE_CHARS, 86_400);
      }
    }
    return true;
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
