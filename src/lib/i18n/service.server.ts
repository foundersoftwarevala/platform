import { timingSafeEqual } from "node:crypto";
import type { Sql } from "postgres";

import { db } from "./database.server";
import { TranslationEngine } from "./engine/engine";
import { createOwnedEngineProvider } from "./engine/providers/owned-engine";
import type { TranslationProvider } from "./engine/types";
import type { GlossaryTerm } from "./glossary";
import { sourceHash } from "./hash";
import { SingleFlight, TtlCache } from "./hot-cache";
import { ANONYMOUS_DAILY_ENGINE_CHARS, TIER_LIMITS, type CallerTier } from "./limits";
import { STATIC_CATALOGUE, publicCatalogue, invalidatePublicCatalogue } from "./catalogue.server";
import { count, observe, type CacheStats } from "./metrics.server";
import { persistenceRule } from "./persist-policy";
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
import { reserveEngineQuota } from "./quota.server";
import { sessionCaller } from "./session.server";

export { db };
export const QUALITY_ATTEMPTED_MODE = "quality_attempted";
export const PACK_SEPARATOR = String.fromCharCode(1);

export function log(message: string, detail?: unknown) {
  console.error(message, detail ?? "");
}

function timed(provider: TranslationProvider): TranslationProvider {
  return {
    ...provider,
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

let engine: TranslationEngine | undefined;

function engineEndpoints(): string[] {
  return [
    ...new Set(
      (process.env.TRANSLATE_PROVIDER_URLS ?? process.env.TRANSLATE_PROVIDER_URL ?? "")
        .split(",")
        .map((endpoint) => endpoint.trim())
        .filter(Boolean),
    ),
  ];
}

export function getTranslationEngine(): TranslationEngine {
  if (!engine) {
    engine = new TranslationEngine(
      engineEndpoints().map((endpoint, index) =>
        timed(
          createOwnedEngineProvider({
            id: index === 0 ? "owned-engine" : `owned-engine-${index + 1}`,
            endpoint,
            token: process.env.TRANSLATE_PROVIDER_TOKEN,
            timeoutMs: Number(process.env.TRANSLATE_PROVIDER_TIMEOUT_MS || 60_000),
          }),
        ),
      ),
      { allowExternal: false },
    );
  }
  return engine;
}

const readyState = { at: 0, ok: false };

export async function engineReachable(): Promise<boolean> {
  const endpoints = engineEndpoints();
  if (!endpoints.length) return false;
  if (Date.now() - readyState.at < 30_000) return readyState.ok;
  const checks = await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(new URL("/ready", endpoint), {
          signal: AbortSignal.timeout(3000),
          redirect: "error",
        });
        const body: unknown = await response.json();
        return (
          response.ok &&
          typeof body === "object" &&
          body !== null &&
          "ready" in body &&
          body.ready === true
        );
      } catch (error) {
        log(
          "[i18n] readiness request failed",
          error instanceof Error ? error.name : "request error",
        );
        return false;
      }
    }),
  );
  const ok = checks.some(Boolean);
  readyState.at = Date.now();
  readyState.ok = ok;
  count(ok ? "engine.ready" : "engine.not_ready");
  return ok;
}

export function translationWorkerConfig(): { enabled: boolean; maxLoad: number | null } {
  const raw = process.env.I18N_JOB_MAX_LOAD;
  const maxLoad = raw ? Number(raw) : null;
  if (maxLoad !== null && (!Number.isFinite(maxLoad) || maxLoad <= 0))
    throw new Error("I18N_JOB_MAX_LOAD must be a finite positive number.");
  return { enabled: process.env.I18N_JOB_WORKER !== "off", maxLoad };
}

export async function translationEngineStatus(): Promise<Record<string, unknown>> {
  const replicas = await Promise.all(
    engineEndpoints().map(async (endpoint) => {
      try {
        const response = await fetch(new URL("/ready", endpoint), {
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        });
        const body: unknown = await response.json();
        return typeof body === "object" && body !== null && !Array.isArray(body)
          ? { ...body, ready: response.ok && "ready" in body && body.ready === true }
          : { ready: false, error: "invalid_readiness" };
      } catch (error) {
        log(
          "[i18n] engine status unavailable",
          error instanceof Error ? error.name : "request error",
        );
        return { ready: false, error: "engine_unavailable" };
      }
    }),
  );
  return {
    ...(replicas.find((replica) => replica.ready) ?? replicas[0] ?? {}),
    configured: replicas.length > 0,
    ready: replicas.some((replica) => replica.ready),
    reachable: replicas.some((replica) => replica.ready),
    status: replicas.find((replica) => replica.ready) ?? replicas[0] ?? null,
    providers: getTranslationEngine().describe(),
    replicas,
  };
}

export async function translationEngineCounters(): Promise<Record<string, number> | null> {
  const values = await Promise.all(
    engineEndpoints().map(async (endpoint) => {
      try {
        const token = process.env.TRANSLATE_PROVIDER_TOKEN;
        const response = await fetch(new URL("/metrics", endpoint), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("Engine metrics request failed.");
        const counters: Record<string, number> = {};
        for (const line of (await response.text()).split("\n")) {
          const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(-?[\d.eE+]+)$/);
          if (match && Number.isFinite(Number(match[2]))) counters[match[1]!] = Number(match[2]);
        }
        return counters;
      } catch (error) {
        log(
          "[i18n] engine metrics unavailable",
          error instanceof Error ? error.name : "request error",
        );
        return null;
      }
    }),
  );
  if (values.every((value) => value === null)) return null;
  const combined: Record<string, number> = {};
  for (const value of values)
    if (value)
      for (const [key, number] of Object.entries(value))
        combined[key] = (combined[key] ?? 0) + number;
  return combined;
}

const MEMORY_TTL_MS = 60_000;
const memoryCache = new TtlCache<Map<string, MemoryEntry>>(50_000);
const memoryFlight = new SingleFlight<void>();
const glossaryCache = new TtlCache<GlossaryTerm[]>(400);
const glossaryFlight = new SingleFlight<GlossaryTerm[]>();
const packCache = new TtlCache<LanguagePack>(400);
const packFlight = new SingleFlight<LanguagePack>();

function memoryKey(source: string, target: string, hash: string) {
  return `${source}|${target}|${hash}`;
}

type StoredMemory = {
  source_hash: string;
  source_language: string;
  target_language: string;
  context_hash: string;
  translated_text: string;
  status: MemoryStatus;
  quality_score: string | number | null;
  version: number;
  engine: string | null;
};

function cacheRows(rows: StoredMemory[], source: string, target: string, hashes: string[]) {
  const byHash = new Map<string, Map<string, MemoryEntry>>(hashes.map((h) => [h, new Map()]));
  for (const row of rows) {
    byHash.get(row.source_hash)?.set(row.context_hash, {
      sourceHash: row.source_hash,
      contextHash: row.context_hash,
      translatedText: row.translated_text,
      status: row.status,
      qualityScore: row.quality_score === null ? null : Number(row.quality_score),
      version: Number(row.version),
      engine: row.engine,
    });
  }
  for (const [hash, contexts] of byHash) {
    memoryCache.set(
      memoryKey(source, target, hash),
      contexts,
      contexts.size ? MEMORY_TTL_MS : 5000,
    );
  }
}

export function createPostgresMemoryStore(client: Sql): TranslationMemoryStore {
  return {
    async lookup({ sourceLanguage, targetLanguage, sourceHashes }) {
      const found = new Map<string, MemoryEntry>();
      const collect = (hash: string) => {
        const rows = memoryCache.get(memoryKey(sourceLanguage, targetLanguage, hash));
        if (!rows) return false;
        for (const [context, entry] of rows) found.set(`${hash}:${context}`, entry);
        return true;
      };
      const missing = [...new Set(sourceHashes)].filter((h) => !collect(h)).sort();
      if (missing.length) {
        await memoryFlight.run(
          JSON.stringify([sourceLanguage, targetLanguage, missing]),
          async () => {
            const started = performance.now();
            const rows = await client<StoredMemory[]>`
            select source_hash, source_language, target_language, context_hash, translated_text,
              status, quality_score, version, engine
            from public.marketplace_translations
            where source_language = ${sourceLanguage} and target_language = ${targetLanguage}
              and source_hash in ${client(missing)}
              and status in ('verified', 'machine', 'needs_review', 'rejected')
          `;
            cacheRows(rows, sourceLanguage, targetLanguage, missing);
            observe("db.memory_lookup", performance.now() - started);
          },
        );
        for (const hash of missing) collect(hash);
      }
      return found;
    },
    async save(records: MemoryRecord[]) {
      if (!records.length) return;
      const rows = records.map((r) => ({
        source_hash: r.sourceHash,
        source_language: r.sourceLanguage,
        target_language: r.targetLanguage,
        locale: r.targetLanguage,
        context_hash: r.contextHash,
        namespace: r.namespace,
        context: r.context,
        translation_key: r.translationKey,
        source_text: r.sourceText,
        translated_text: r.translatedText,
        status: r.status,
        quality_score: r.qualityScore,
        quality_flags: r.qualityFlags,
        engine: r.engine,
        engine_version: r.engineVersion,
        provider: r.engine,
        model: r.engineVersion,
        metadata: { provider_kind: r.providerKind, mode: r.mode ?? null },
      }));
      const started = performance.now();
      await client`
        insert into public.marketplace_translations ${client(rows)}
        on conflict (source_hash, source_language, target_language, context_hash)
        do update set translated_text = excluded.translated_text, status = excluded.status,
          quality_score = excluded.quality_score, quality_flags = excluded.quality_flags,
          engine = excluded.engine, engine_version = excluded.engine_version,
          metadata = excluded.metadata
      `;
      // The database review guard is authoritative; never cache the requested
      // overwrite before checking what the database actually accepted.
      for (const r of records) {
        memoryCache.delete(memoryKey(r.sourceLanguage, r.targetLanguage, r.sourceHash));
        packCache.delete(r.targetLanguage);
      }
      observe("db.memory_save", performance.now() - started);
    },
    async markQualityAttempted(rows) {
      for (const row of rows) {
        await client`
          update public.marketplace_translations
          set metadata = metadata || jsonb_build_object('mode', ${QUALITY_ATTEMPTED_MODE}::text)
          where source_hash = ${row.sourceHash} and source_language = ${row.sourceLanguage}
            and target_language = ${row.targetLanguage} and context_hash = ${row.contextHash}
            and status = 'machine'
        `;
        count("memory.quality_attempted");
      }
    },
  };
}

export function createPostgresGlossaryStore(client: Sql): GlossaryStore {
  return {
    async load({ source, target }) {
      const key = `${source}|${target}`;
      const cached = glossaryCache.get(key);
      if (cached) return cached;
      return glossaryFlight.run(key, async () => {
        const rows = await client`
          select source_term, target_term, source_language, target_language,
            rule, case_sensitive, namespace from public.i18n_glossary_terms
          where status = 'approved' and source_language = ${source}
            and (target_language is null or target_language = ${target})
        `;
        const terms = rows.map((row): GlossaryTerm => ({
          sourceTerm: row.source_term,
          targetTerm: row.target_term,
          sourceLanguage: row.source_language,
          targetLanguage: row.target_language,
          rule: row.rule,
          caseSensitive: row.case_sensitive,
          namespace: row.namespace,
        }));
        glossaryCache.set(key, terms, 60_000);
        return terms;
      });
    },
  };
}

export type LanguagePack = { body: string; etag: string; count: number };

export async function languagePack(code: string): Promise<LanguagePack> {
  const client = await db();
  const publicTexts = await publicCatalogue(client);
  const cached = packCache.get(code);
  if (cached) return cached;
  return packFlight.run(code, async () => {
    const started = performance.now();
    const rows = await client`
      select source_text, context, translated_text, status
      from public.marketplace_translations
      where source_language = 'en' and target_language = ${code} and namespace = 'ui'
        and status in ('machine', 'verified', 'needs_review', 'rejected', 'stale')
      order by updated_at desc, id limit 30000
    `;
    const catalogue = new Map<string, string>();
    const withheld: string[] = [];
    for (const row of rows) {
      if (!isCatalogueText(row.source_text, publicTexts)) continue;
      const key = `${row.context ?? ""}${PACK_SEPARATOR}${row.source_text}`;
      if (["needs_review", "rejected", "stale"].includes(row.status)) {
        withheld.push(key);
      } else if (row.translated_text) {
        if (!catalogue.has(key)) catalogue.set(key, row.translated_text);
      }
    }
    const entries = Object.fromEntries([...catalogue].slice(0, 6000));
    const terms = await createPostgresGlossaryStore(client).load({
      source: "en",
      target: code,
      namespace: "ui",
    });
    const body = JSON.stringify({
      lang: code,
      count: Object.keys(entries).length,
      entries,
      withheld,
      locked: terms
        .filter((t) => t.rule === "locked" && !t.targetTerm && !t.namespace)
        .map((t) => t.sourceTerm),
      truncated: rows.length === 30000 || catalogue.size > 6000,
      source: "vps-postgresql",
      fallback: "en",
    });
    const pack = {
      body,
      etag: `W/"${(await sourceHash(body)).slice(0, 20)}"`,
      count: Object.keys(entries).length,
    };
    packCache.set(code, pack, 60_000);
    observe("db.pack_build", performance.now() - started);
    count("pack.built");
    return pack;
  });
}

export function invalidateTranslationCaches() {
  invalidatePublicCatalogue();
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
  return { memory: stats(memoryCache), glossary: stats(glossaryCache), packs: stats(packCache) };
}

let overrides: { at: number; disabled: Set<string> } | undefined;
export function invalidateLanguageOverrides() {
  overrides = undefined;
}

export async function disabledLanguages(client: Sql): Promise<Set<string>> {
  if (overrides && Date.now() - overrides.at < 60_000) return overrides.disabled;
  const rows = await client`select code from public.i18n_languages where not enabled`;
  overrides = { at: Date.now(), disabled: new Set(rows.map((r) => String(r.code))) };
  return overrides.disabled;
}

export type Caller = { tier: CallerTier; subject: string; userId: string | null };

export async function resolveCaller(
  authorization: string | null,
  address: string,
  internalToken?: string | null,
): Promise<Caller> {
  const expected = process.env.INTERNAL_API_TOKEN?.trim();
  const presented = internalToken?.trim();
  if (
    expected &&
    presented &&
    Buffer.byteLength(expected) === Buffer.byteLength(presented) &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(presented))
  ) {
    return { tier: "operator", subject: "internal:token", userId: null };
  }
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (token) {
    const caller = await sessionCaller(token);
    if (caller) return caller;
  }
  return { tier: "anonymous", subject: `anon:${await sourceHash(address)}`, userId: null };
}

export function isCatalogueText(
  text: string,
  catalogue: ReadonlySet<string> = STATIC_CATALOGUE,
): boolean {
  return catalogue.has(text.trim());
}

export async function translateForCaller(
  request: Omit<PipelineRequest, "mayPersist">,
  caller: Caller,
): Promise<PipelineResult> {
  const client = await db();
  const catalogue = await publicCatalogue(client);
  const disabled = await disabledLanguages(client);
  const limits = TIER_LIMITS[caller.tier];
  let refund: (() => Promise<void>) | undefined;
  const quota = async (units: number) => {
    const windows = [{ subject: caller.subject, limit: limits.engineCharsPerHour, seconds: 3600 }];
    if (caller.tier === "anonymous")
      windows.push({ subject: "anon:all", limit: ANONYMOUS_DAILY_ENGINE_CHARS, seconds: 86400 });
    const reservation = await reserveEngineQuota(client, units, windows);
    refund = reservation.refund;
    return reservation.allowed;
  };
  return runTranslationPipeline(
    {
      ...request,
      mayPersist: persistenceRule(request.namespace ?? "ui", caller.tier, (text) =>
        isCatalogueText(text, catalogue),
      ),
    },
    {
      engine: getTranslationEngine(),
      memory: createPostgresMemoryStore(client),
      glossary: createPostgresGlossaryStore(client),
      quota,
      refundQuota: async () => {
        await refund?.();
      },
      isLanguageEnabled: (code) => !disabled.has(code),
      log,
    },
  );
}
