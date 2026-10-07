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
  translationEngineStatus,
  translationEngineCounters,
  invalidateLanguageOverrides,
  invalidateTranslationCaches,
  translationCacheStats,
  resolveCaller,
  type Caller,
} from "./service.server";
import { UI_DICTIONARY } from "./ui-dictionary";
import { languageAuthorization } from "./session-contract";

/**
 * Language Manager: what the /language-manager console reads and changes.
 * Every call is made by a resolved operator (admin or boss); the handler in
 * src/routes/api/i18n/admin.ts checks that before anything here runs.
 */

const REVIEW_STATUSES = ["needs_review", "machine", "verified", "rejected", "legacy"] as const;

export async function requireLanguageOperator(request: Request): Promise<Caller | Response> {
  const caller = await resolveCaller(
    languageAuthorization(request),
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

async function database() {
  return db();
}

/** The translation engine's own readiness, asked directly. */
export async function engineStatus(): Promise<Record<string, unknown>> {
  return translationEngineStatus();
}

/** The engine's own counters (Prometheus text from its /metrics), as name -> value. */
async function engineCounters(): Promise<Record<string, number> | null> {
  return translationEngineCounters();
}

/**
 * Live measurements: this server's request rates, latency percentiles, cache
 * hit ratios, memory and event-loop delay; the job queue and how long the
 * database takes to answer; the engine's readiness and counters. Read by the
 * Language Manager and by the host's health check (deploy/i18n-health.sh).
 */
export async function metrics() {
  const { metricsSnapshot } = await import("./metrics.server");
  const client = await database();
  const started = performance.now();
  const jobs = await reportRows(client<{ status: string; jobs: number | string }[]>`
    select * from public.i18n_job_summary()`);
  const databaseMs = Math.round(performance.now() - started);
  const queue: Record<string, number> = {};
  for (const row of jobs.data ?? []) {
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
  const client = await database();
  const [coverage, jobs, languages, glossary] = await Promise.all([
    reportRows(client<({ target_language: string } & Record<string, unknown>)[]>`
      select target_language, verified::double precision as verified,
        machine::double precision as machine, needs_review::double precision as needs_review,
        rejected::double precision as rejected, legacy::double precision as legacy
      from public.i18n_translation_coverage()`),
    reportRows(client<Record<string, unknown>[]>`
      select status, target_language, jobs::double precision as jobs from public.i18n_job_summary()`),
    reportRows(client<
      { code: string; enabled: boolean; translation_status: string; updated_at: Date }[]
    >`
      select code, enabled, translation_status, updated_at from public.i18n_languages`),
    reportRows(client<{ total: number | string }[]>`
      select count(*) as total from public.i18n_glossary_terms`),
  ]);
  const catalogue = Object.keys(UI_DICTIONARY.en ?? {});
  const translatable = new Set(translatableLanguages().map((l) => l.code));
  const dbLanguages = new Map((languages.data ?? []).map((r) => [r.code, r]));
  const coverageByCode = new Map((coverage.data ?? []).map((r) => [r.target_language, r]));

  return {
    engine: await engineStatus(),
    catalogueSize: catalogue.length,
    glossaryTerms: glossary.data?.[0] ? Number(glossary.data[0].total) : null,
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
      .map((e) => e!.message),
  };
}

async function reportRows<T>(query: PromiseLike<T>) {
  try {
    return { data: await query, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
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
  const client = await database();
  let languageCode: string | null = null;
  if (query.language) {
    const language = getLanguage(query.language);
    if (!language) throw new Error("Unknown language.");
    languageCode = language.code;
  }
  const search = query.q ? `%${query.q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const filter = client`
    status = ${query.status} and target_language is not null
    and (${languageCode}::text is null or target_language = ${languageCode})
    and (${search}::text is null or source_text ilike ${search})`;
  const [rows, totals] = await Promise.all([
    client`
      select id, source_text, translated_text, source_language, target_language,
        namespace, context, status, quality_score::double precision as quality_score, quality_flags, engine, engine_version,
        version, reviewed_at, updated_at
      from public.marketplace_translations where ${filter}
      order by updated_at desc, id limit ${query.limit} offset ${query.offset}`,
    client<{ total: number | string }[]>`
      select count(*) as total from public.marketplace_translations where ${filter}`,
  ]);
  return { rows: [...rows], total: Number(totals[0]?.total ?? 0) };
}

export async function revisions(id: string) {
  z.string().uuid().parse(id);
  const client = await database();
  const rows = await client`
    select version, translated_text, status, quality_score::double precision as quality_score, engine, engine_version, changed_by, changed_at
    from public.i18n_translation_revisions
    where translation_id = ${id}::uuid order by version desc`;
  return { revisions: [...rows] };
}

export async function glossaryList() {
  const client = await database();
  const rows = await client`
    select * from public.i18n_glossary_terms order by source_term asc limit 1000`;
  return { terms: [...rows] };
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
    source: z.string().max(32).default("en"),
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
  const client = await database();
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
          source: input.source,
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
      if (input.text !== undefined) {
        if (input.decision !== "verify")
          throw new Error("An edited translation can only be saved as verified.");
      }
      const status =
        input.decision === "verify"
          ? "verified"
          : input.decision === "reject"
            ? "rejected"
            : "needs_review";
      const [data] = await client`
        update public.marketplace_translations set
          status = ${status}, reviewed_by = ${input.decision === "reopen" ? null : caller.userId}::uuid,
          reviewed_at = ${input.decision === "reopen" ? null : now}::timestamptz, review_note = ${note},
          translated_text = case when ${input.text !== undefined} then ${input.text ?? null} else translated_text end,
          engine = case when ${input.text !== undefined} then 'human' else engine end
        where id = ${input.id}::uuid and target_language is not null
        returning id, status, translated_text, version`;
      if (!data) throw new Error("Translation not found.");
      invalidateTranslationCaches();
      return data;
    }
    case "set_language_enabled": {
      const language = getLanguage(input.code);
      if (!language || language.replacedBy) throw new Error("Unknown or retired language.");
      if (language.code === "en" && !input.enabled)
        throw new Error("The source language cannot be disabled.");
      const rows = await client`
        update public.i18n_languages set enabled = ${input.enabled}
        where code = ${language.code} returning code`;
      if (!rows.length) throw new Error("Language not found in the database.");
      invalidateLanguageOverrides();
      invalidateTranslationCaches();
      return { code: language.code, enabled: input.enabled };
    }
    case "glossary_save": {
      const term = input.term;
      const target = term.target_language ? getLanguage(term.target_language) : null;
      if (term.target_language && !target?.enabled) throw new Error("Unknown target language.");
      const now = new Date().toISOString();
      const rows = term.id
        ? await client`
            update public.i18n_glossary_terms set
              source_term = ${term.source_term}, target_term = ${term.target_term},
              target_language = ${target?.code ?? null}, source_language = 'en',
              rule = ${term.rule}, case_sensitive = ${term.case_sensitive}, namespace = ${term.namespace},
              context = ${term.context}, status = ${term.status}, notes = ${term.notes},
              approved_by = case when ${term.status === "approved"} then ${caller.userId}::uuid else approved_by end,
              approved_at = case when ${term.status === "approved"} then ${now}::timestamptz else approved_at end
            where id = ${term.id}::uuid returning *`
        : await client`
            insert into public.i18n_glossary_terms
              (source_term, target_term, target_language, source_language, rule, case_sensitive,
               namespace, context, status, notes, approved_by, approved_at, created_by)
            values (${term.source_term}, ${term.target_term}, ${target?.code ?? null}, 'en', ${term.rule},
              ${term.case_sensitive}, ${term.namespace}, ${term.context}, ${term.status}, ${term.notes},
              ${term.status === "approved" ? caller.userId : null}::uuid,
              ${term.status === "approved" ? now : null}::timestamptz, ${caller.userId}::uuid)
            returning *`;
      const data = rows[0];
      if (!data) throw new Error("Glossary term not found.");
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
  const client = await database();
  type ReviewRow = {
    id: string;
    status: string;
    source_text: string;
    translated_text: string | null;
    source_language: string;
    target_language: string;
    namespace: string;
    context: string | null;
    source_hash: string;
    context_hash: string;
  };
  const [row] = await client<ReviewRow[]>`
    select id, status, source_text, translated_text, source_language, target_language,
      namespace, context, source_hash, context_hash
    from public.marketplace_translations
    where id = ${id}::uuid and target_language is not null`;
  if (!row) throw new Error("Translation not found.");
  const note = `${decision} by ${caller.userId ?? "operator"} at ${now}`;

  if (decision === "retranslate") {
    if (row.status === "verified")
      throw new Error("A verified translation is locked. Reopen it first to translate it again.");
    const updated = await client`
      update public.marketplace_translations set status = 'stale', review_note = ${note}
      where id = ${row.id}::uuid and status <> 'verified' returning id`;
    if (!updated.length)
      throw new Error("A verified translation is locked. Reopen it first to translate it again.");
    invalidateTranslationCaches();
    const queued = await enqueueJobs(
      [
        {
          text: row.source_text,
          source: row.source_language,
          target: row.target_language,
          namespace: row.namespace,
          context: row.context,
          priority: 1,
        },
      ],
      caller.userId,
    );
    // Already queued (the catalogue sync queues every message): move it ahead.
    const raised = await client`
      update public.i18n_translation_jobs set priority = 1
      where source_hash = ${row.source_hash} and source_language = ${row.source_language}
        and target_language = ${row.target_language} and context_hash = ${row.context_hash}
        and status = 'queued' returning id`;
    // The update also finds a job inserted just now; count each job once.
    return { id: row.id, status: "stale", queued: Math.max(queued, raised?.length ?? 0) };
  }

  const source = row.source_text;
  const translation = (text ?? row.translated_text ?? "").trim();
  if (!translation) throw new Error("There is no translation to lock.");
  if (source.length > LOCKABLE_LENGTH)
    throw new Error(
      `Only terms and labels up to ${LOCKABLE_LENGTH} characters can be locked. Verify this translation instead.`,
    );
  const verified = await client.begin(async (transaction) => {
    const [locked] = await transaction<ReviewRow[]>`
      select id, status, source_text, translated_text, source_language, target_language,
        namespace, context, source_hash, context_hash
      from public.marketplace_translations where id = ${id}::uuid and target_language is not null
      for update`;
    if (!locked) throw new Error("Translation not found.");
    const lockedTranslation = (text ?? locked.translated_text ?? "").trim();
    if (!lockedTranslation) throw new Error("There is no translation to lock.");
    if (locked.source_text.length > LOCKABLE_LENGTH)
      throw new Error(`Only terms and labels up to ${LOCKABLE_LENGTH} characters can be locked.`);
    const [saved] = await transaction`
      update public.marketplace_translations set status = 'verified',
        reviewed_by = ${caller.userId}::uuid, reviewed_at = ${now}::timestamptz,
        review_note = ${note},
        translated_text = case when ${text !== undefined} then ${lockedTranslation} else translated_text end,
        engine = case when ${text !== undefined} then 'human' else engine end
      where id = ${id}::uuid returning id, status, translated_text, version`;
    if (!saved) throw new Error("Translation not found.");
    const existing = await transaction<{ id: string }[]>`
      select id from public.i18n_glossary_terms
      where source_term = ${locked.source_text} and source_language = ${locked.source_language}
        and target_language = ${locked.target_language} and namespace = ${locked.namespace}`;
    if (existing.length > 1) throw new Error("Multiple glossary terms match this translation.");
    const notes = `Locked from the review queue (${locked.context ? `context: ${locked.context}` : "no context"}).`;
    if (existing[0]) {
      await transaction`
        update public.i18n_glossary_terms set target_term = ${lockedTranslation},
          rule = 'preferred', case_sensitive = true, status = 'approved',
          approved_by = ${caller.userId}::uuid, approved_at = ${now}::timestamptz, notes = ${notes}
        where id = ${existing[0].id}::uuid`;
    } else {
      await transaction`
        insert into public.i18n_glossary_terms
          (source_term, target_term, source_language, target_language, rule, case_sensitive,
           namespace, status, approved_by, approved_at, notes, created_by)
        values (${locked.source_text}, ${lockedTranslation}, ${locked.source_language},
          ${locked.target_language}, 'preferred', true, ${locked.namespace}, 'approved',
          ${caller.userId}::uuid, ${now}::timestamptz, ${notes}, ${caller.userId}::uuid)`;
    }
    return saved;
  });
  invalidateTranslationCaches();
  return { ...verified, locked: true };
}
