import { z } from "zod";

import {
  enqueueCatalogue,
  enqueueJobs,
  runJobBatch,
  syncMessageCatalogue,
  translatableLanguages,
} from "./jobs.server";
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

export const action = z.discriminatedUnion("action", [
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
    // Lower runs sooner (the queue is ordered by priority, then age). Lets an
    // operator put a page's text ahead of the catalogue backlog.
    priority: z.number().int().min(1).max(100).default(100),
  }),
  z.object({ action: z.literal("run_jobs"), limit: z.number().int().min(1).max(50).default(12) }),
  z.object({
    action: z.literal("review"),
    id: z.string().uuid(),
    // verify = approve (edited text is saved as the reviewer's), reject,
    // reopen = back to needs_review, retranslate = ask the engine again,
    // lock = approve and make it this language's required terminology.
    decision: z.enum(["verify", "reject", "reopen", "retranslate", "lock"]),
    text: z.string().min(1).max(10000).optional(),
  }),
  z.object({
    action: z.literal("set_language_enabled"),
    code: z.string().max(32),
    enabled: z.boolean(),
  }),
  z.object({ action: z.literal("glossary_save"), term: glossaryTerm }),
  z.object({ action: z.literal("sync_messages") }),
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
          priority: input.priority,
        })),
      );
      return { queued: await enqueueJobs(items, caller.userId) };
    }
    case "run_jobs":
      return runJobBatch(input.limit);
    case "sync_messages":
      return syncMessageCatalogue({ requestedBy: caller.userId });
    case "review": {
      const now = new Date().toISOString();
      if (input.decision === "retranslate" || input.decision === "lock") {
        return reviewAction(input.decision, input.id, input.text, caller, now);
      }
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

/** Longest string that can be locked as terminology (the glossary's limit). */
const LOCKABLE_LENGTH = 200;

/**
 * Re-translate and Lock, from the review queue.
 *
 * Re-translate marks the row stale (not served) and queues it ahead of other
 * work; the worker translates it again and the result goes through the quality
 * gate as usual. A verified row is a person's decision and is not re-translated:
 * reopen it first.
 *
 * Lock approves the translation (with the reviewer's edit, if any) and saves it
 * as approved, preferred terminology for that language, so the same English is
 * translated this way wherever it appears. Only short strings - terms and
 * labels - can be locked.
 */
async function reviewAction(
  decision: "retranslate" | "lock",
  id: string,
  text: string | undefined,
  caller: Caller,
  now: string,
) {
  const client = database();
  const { data: row, error } = await client
    .from("marketplace_translations")
    .select(
      "id, status, source_text, translated_text, target_language, namespace, context, source_hash, context_hash",
    )
    .eq("id", id)
    .not("target_language", "is", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Translation not found.");
  const note = `${decision} by ${caller.userId ?? "operator"} at ${now}`;

  if (decision === "retranslate") {
    if (row.status === "verified")
      throw new Error("A verified translation is locked. Reopen it first to translate it again.");
    const { error: updateError } = await client
      .from("marketplace_translations")
      .update({ status: "stale", review_note: note })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
    const queued = await enqueueJobs(
      [
        {
          text: String(row.source_text),
          target: String(row.target_language),
          namespace: String(row.namespace),
          context: (row.context as string | null) ?? null,
          priority: 1,
        },
      ],
      caller.userId,
    );
    // Already queued (the catalogue sync queues every message): move it ahead.
    const { data: raised, error: raiseError } = await client
      .from("i18n_translation_jobs")
      .update({ priority: 1 })
      .eq("source_hash", row.source_hash)
      .eq("target_language", row.target_language)
      .eq("context_hash", row.context_hash)
      .eq("status", "queued")
      .select("id");
    if (raiseError) throw new Error(raiseError.message);
    invalidateTranslationCaches();
    // The update also finds a job inserted just now; count each job once.
    return { id: row.id, status: "stale", queued: Math.max(queued, raised?.length ?? 0) };
  }

  const source = String(row.source_text);
  const translation = (text ?? String(row.translated_text ?? "")).trim();
  if (!translation) throw new Error("There is no translation to lock.");
  if (source.length > LOCKABLE_LENGTH)
    throw new Error(
      `Only terms and labels up to ${LOCKABLE_LENGTH} characters can be locked. Verify this translation instead.`,
    );
  const { data: verified, error: verifyError } = await client
    .from("marketplace_translations")
    .update({
      status: "verified",
      reviewed_by: caller.userId,
      reviewed_at: now,
      review_note: note,
      ...(text !== undefined ? { translated_text: translation, engine: "human" } : {}),
    })
    .eq("id", row.id)
    .select("id, status, translated_text, version")
    .maybeSingle();
  if (verifyError) throw new Error(verifyError.message);

  const term = {
    source_term: source,
    target_term: translation,
    source_language: "en",
    target_language: row.target_language,
    rule: "preferred",
    case_sensitive: true,
    namespace: row.namespace,
    status: "approved",
    approved_by: caller.userId,
    approved_at: now,
    notes: `Locked from the review queue (${row.context ? `context: ${row.context}` : "no context"}).`,
  };
  const { data: existing, error: findError } = await client
    .from("i18n_glossary_terms")
    .select("id")
    .eq("source_term", source)
    .eq("target_language", row.target_language)
    .eq("namespace", row.namespace)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  const saved = existing
    ? await client.from("i18n_glossary_terms").update(term).eq("id", existing.id)
    : await client.from("i18n_glossary_terms").insert({ ...term, created_by: caller.userId });
  if (saved.error) throw new Error(saved.error.message);
  invalidateTranslationCaches();
  return { ...(verified ?? { id: row.id }), locked: true };
}
