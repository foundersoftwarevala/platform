import { z } from "zod";

import { enqueueCatalogue, enqueueJobs, runJobBatch, translatableLanguages } from "./jobs.server";
import { NAMESPACE_PATTERN } from "./pipeline";
import { DICTIONARY_LANGUAGES, SUPPORTED_LANGUAGES, getLanguage } from "./registry";
import {
  db,
  getTranslationEngine,
  invalidateLanguageOverrides,
  invalidateTranslationCaches,
  translationCacheStats,
  resolveCaller,
  type Caller,
} from "./service.server";
import { UI_DICTIONARY } from "./ui-dictionary";

/**
 * Language Manager: what the /language-manager console reads and changes.
 * Every call is made by a resolved operator (admin or boss); the handler in
 * src/routes/api/i18n/admin.ts checks that before anything here runs.
 */

const REVIEW_STATUSES = ["needs_review", "machine", "verified", "rejected", "legacy"] as const;

export async function requireLanguageOperator(request: Request): Promise<Caller | Response> {
  const caller = await resolveCaller(
    request.headers.get("authorization"),
    "operator",
    request.headers.get("x-internal-token"),
  );
  if (caller.tier !== "operator") {
    return Response.json(
      { error: "Admin or boss sign-in required." },
      { status: caller.tier === "anonymous" ? 401 : 403 },
    );
  }
  return caller;
}

function database() {
  const client = db();
  if (!client) throw new Error("The database is not configured on this server.");
  return client;
}

/** The translation engine's own readiness, asked directly. */
export async function engineStatus(): Promise<Record<string, unknown>> {
  const endpoint = process.env.TRANSLATE_PROVIDER_URL?.trim();
  const engine = getTranslationEngine();
  const providers = engine.describe();
  if (!endpoint) return { configured: false, providers };
  try {
    const base = new URL(endpoint);
    const response = await fetch(new URL("/ready", base), { signal: AbortSignal.timeout(5000) });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { configured: true, reachable: true, ready: response.ok, status: body, providers };
  } catch (error) {
    return { configured: true, reachable: false, error: String(error), providers };
  }
}

/** The engine's own counters (Prometheus text from its /metrics), as name -> value. */
async function engineCounters(): Promise<Record<string, number> | null> {
  const endpoint = process.env.TRANSLATE_PROVIDER_URL?.trim();
  if (!endpoint) return null;
  try {
    const token = process.env.TRANSLATE_PROVIDER_TOKEN?.trim();
    const response = await fetch(new URL("/metrics", new URL(endpoint)), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const counters: Record<string, number> = {};
    for (const line of (await response.text()).split("\n")) {
      if (!line.startsWith("svt_")) continue;
      const cut = line.lastIndexOf(" ");
      const value = Number(line.slice(cut + 1));
      if (Number.isFinite(value)) counters[line.slice(0, cut)] = value;
    }
    return counters;
  } catch {
    return null;
  }
}

/**
 * Live measurements: this server's request rates, latency percentiles, cache
 * hit ratios, memory and event-loop delay; the job queue and how long the
 * database takes to answer; the engine's readiness and counters. Read by the
 * Language Manager and by the host's health check (deploy/i18n-health.sh).
 */
export async function metrics() {
  const { metricsSnapshot } = await import("./metrics.server");
  const client = database();
  const started = performance.now();
  const jobs = await client.rpc("i18n_job_summary");
  const databaseMs = Math.round(performance.now() - started);
  const queue: Record<string, number> = {};
  for (const row of (jobs.data ?? []) as { status: string; jobs: number }[]) {
    queue[row.status] = (queue[row.status] ?? 0) + Number(row.jobs);
  }
  const [engine, counters] = await Promise.all([engineStatus(), engineCounters()]);
  return {
    app: metricsSnapshot(translationCacheStats()),
    database: { reachable: !jobs.error, latencyMs: databaseMs },
    queue,
    engine: { ...engine, counters },
  };
}

export async function overview() {
  const client = database();
  const [coverage, jobs, languages, glossary] = await Promise.all([
    client.rpc("i18n_translation_coverage"),
    client.rpc("i18n_job_summary"),
    client.from("i18n_languages").select("code, enabled, translation_status, updated_at"),
    client.from("i18n_glossary_terms").select("id", { count: "exact", head: true }),
  ]);
  const catalogue = Object.keys(UI_DICTIONARY.en ?? {});
  const translatable = new Set(translatableLanguages().map((l) => l.code));
  const dbLanguages = new Map(
    ((languages.data ?? []) as { code: string; enabled: boolean }[]).map((r) => [r.code, r]),
  );
  const coverageByCode = new Map(
    ((coverage.data ?? []) as { target_language: string }[]).map((r) => [r.target_language, r]),
  );

  return {
    engine: await engineStatus(),
    catalogueSize: catalogue.length,
    glossaryTerms: glossary.count ?? null,
    languages: SUPPORTED_LANGUAGES.map((language) => ({
      code: language.code,
      name: language.name,
      nativeName: language.nativeName,
      script: language.script,
      direction: language.direction,
      translationStatus: language.translationStatus,
      enabled: dbLanguages.get(language.code)?.enabled ?? language.enabled,
      translatable: translatable.has(language.code),
      dictionaryEntries: DICTIONARY_LANGUAGES.includes(language.code)
        ? Object.keys(UI_DICTIONARY[language.code] ?? {}).length
        : 0,
      memory: coverageByCode.get(language.code) ?? null,
    })),
    jobs: jobs.data ?? [],
    errors: [coverage.error, jobs.error, languages.error, glossary.error]
      .filter(Boolean)
      .map((e) => (e as { message: string }).message),
  };
}

const reviewQuery = z.object({
  language: z.string().max(32).optional(),
  status: z.enum(REVIEW_STATUSES).default("needs_review"),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function reviewQueue(params: URLSearchParams) {
  const query = reviewQuery.parse(Object.fromEntries(params));
  let request = database()
    .from("marketplace_translations")
    .select(
      "id, source_text, translated_text, source_language, target_language, namespace, context, status, quality_score, quality_flags, engine, engine_version, version, reviewed_at, updated_at",
      { count: "exact" },
    )
    .eq("status", query.status)
    .order("updated_at", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);
  if (query.language) {
    const language = getLanguage(query.language);
    if (!language) throw new Error("Unknown language.");
    request = request.eq("target_language", language.code);
  }
  if (query.q) request = request.ilike("source_text", `%${query.q.replace(/[%_]/g, "\\$&")}%`);
  const { data, error, count } = await request;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function revisions(id: string) {
  z.string().uuid().parse(id);
  const { data, error } = await database()
    .from("i18n_translation_revisions")
    .select(
      "version, translated_text, status, quality_score, engine, engine_version, changed_by, changed_at",
    )
    .eq("translation_id", id)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return { revisions: data ?? [] };
}

export async function glossaryList() {
  const { data, error } = await database()
    .from("i18n_glossary_terms")
    .select("*")
    .order("source_term", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return { terms: data ?? [] };
}

const glossaryTerm = z
  .object({
    id: z.string().uuid().optional(),
    source_term: z.string().trim().min(1).max(200),
    target_term: z.string().trim().min(1).max(200).nullable().default(null),
    target_language: z.string().max(32).nullable().default(null),
    rule: z.enum(["locked", "preferred", "forbidden"]),
    case_sensitive: z.boolean().default(true),
    namespace: z.string().regex(NAMESPACE_PATTERN).nullable().default(null),
    context: z.string().max(500).nullable().default(null),
    status: z.enum(["draft", "approved", "deprecated"]).default("draft"),
    notes: z.string().max(1000).nullable().default(null),
  })
  .refine((t) => t.rule === "locked" || t.target_term !== null, {
    message: "This rule needs a target term.",
  });

const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("enqueue_catalogue"),
    languages: z.union([z.literal("all"), z.array(z.string().max(32)).min(1).max(200)]),
    refresh: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("enqueue_texts"),
    texts: z.array(z.string().min(1).max(5000)).min(1).max(500),
    languages: z.union([z.literal("all"), z.array(z.string().max(32)).min(1).max(200)]),
    namespace: z.string().regex(NAMESPACE_PATTERN).default("catalogue"),
    context: z.string().max(500).nullable().default(null),
    refresh: z.boolean().default(false),
  }),
  z.object({ action: z.literal("run_jobs"), limit: z.number().int().min(1).max(50).default(12) }),
  z.object({
    action: z.literal("review"),
    id: z.string().uuid(),
    decision: z.enum(["verify", "reject", "reopen"]),
    text: z.string().min(1).max(10000).optional(),
  }),
  z.object({
    action: z.literal("set_language_enabled"),
    code: z.string().max(32),
    enabled: z.boolean(),
  }),
  z.object({ action: z.literal("glossary_save"), term: glossaryTerm }),
]);

export async function performAction(body: unknown, caller: Caller) {
  const input = action.parse(body);
  const client = database();
  switch (input.action) {
    case "enqueue_catalogue":
      return enqueueCatalogue(input.languages, {
        refresh: input.refresh,
        requestedBy: caller.userId,
      });
    case "enqueue_texts": {
      const targets =
        input.languages === "all" ? translatableLanguages().map((l) => l.code) : input.languages;
      const items = targets.flatMap((target) =>
        input.texts.map((text) => ({
          text,
          target,
          namespace: input.namespace,
          context: input.context,
          refresh: input.refresh,
        })),
      );
      return { queued: await enqueueJobs(items, caller.userId) };
    }
    case "run_jobs":
      return runJobBatch(input.limit);
    case "review": {
      const now = new Date().toISOString();
      // review_note marks this as a person's decision; the database lets only
      // such writes change a verified or rejected row.
      const note = `${input.decision} by ${caller.userId ?? "operator"} at ${now}`;
      const patch: Record<string, unknown> =
        input.decision === "verify"
          ? { status: "verified", reviewed_by: caller.userId, reviewed_at: now, review_note: note }
          : input.decision === "reject"
            ? {
                status: "rejected",
                reviewed_by: caller.userId,
                reviewed_at: now,
                review_note: note,
              }
            : { status: "needs_review", reviewed_by: null, reviewed_at: null, review_note: note };
      if (input.text !== undefined) {
        if (input.decision !== "verify")
          throw new Error("An edited translation can only be saved as verified.");
        patch.translated_text = input.text;
        patch.engine = "human";
      }
      const { data, error } = await client
        .from("marketplace_translations")
        .update(patch)
        .eq("id", input.id)
        .not("target_language", "is", null)
        .select("id, status, translated_text, version")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Translation not found.");
      invalidateTranslationCaches();
      return data;
    }
    case "set_language_enabled": {
      const language = getLanguage(input.code);
      if (!language || language.replacedBy) throw new Error("Unknown or retired language.");
      if (language.code === "en" && !input.enabled)
        throw new Error("The source language cannot be disabled.");
      const { error } = await client
        .from("i18n_languages")
        .update({ enabled: input.enabled })
        .eq("code", language.code);
      if (error) throw new Error(error.message);
      invalidateLanguageOverrides();
      invalidateTranslationCaches();
      return { code: language.code, enabled: input.enabled };
    }
    case "glossary_save": {
      const term = input.term;
      const target = term.target_language ? getLanguage(term.target_language) : null;
      if (term.target_language && !target?.enabled) throw new Error("Unknown target language.");
      const row = {
        ...term,
        target_language: target?.code ?? null,
        source_language: "en",
        ...(term.status === "approved"
          ? { approved_by: caller.userId, approved_at: new Date().toISOString() }
          : {}),
        ...(term.id ? {} : { created_by: caller.userId }),
      };
      const { data, error } = term.id
        ? await client
            .from("i18n_glossary_terms")
            .update(row)
            .eq("id", term.id)
            .select()
            .maybeSingle()
        : await client.from("i18n_glossary_terms").insert(row).select().maybeSingle();
      if (error) throw new Error(error.message);
      invalidateTranslationCaches();
      return data;
    }
  }
}
