import { cpus, loadavg } from "node:os";

import { contextHash, sourceHash } from "./hash";
import {
  NAMESPACE_PATTERN,
  PRIVATE_NAMESPACES,
  PipelineError,
  runTranslationPipeline,
} from "./pipeline";
import {
  SOURCE_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguage,
  type LanguageDefinition,
} from "./registry";
import {
  QUALITY_ATTEMPTED_MODE,
  createPostgresGlossaryStore,
  createPostgresMemoryStore,
  db,
  disabledLanguages,
  engineReachable,
  getTranslationEngine,
  translationWorkerConfig,
  log,
} from "./service.server";
import { allMessages } from "./messages";
import { UI_DICTIONARY } from "./ui-dictionary";
import { count } from "./metrics.server";
import { STATIC_CATALOGUE, publicCatalogue } from "./catalogue.server";

/**
 * Background translation.
 *
 * Jobs live in public.i18n_translation_jobs. This module enqueues them (the
 * interface catalogue for chosen languages, or any text an operator submits)
 * and works them off through the translation pipeline in "quality" mode, so
 * the results land in translation memory before anyone asks for them.
 *
 * The worker runs inside the application process: a timer claims a small
 * batch, translates it and records the outcome. Claims are leases taken with
 * SKIP LOCKED, so several application instances never duplicate work, and a
 * crashed instance's jobs are picked up again when the lease expires.
 */

/** Identifies this worker while it holds a job lease. One per process. */
const WORKER_ID = `worker-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
// Jobs claimed per batch. The engine decodes eight segments at a time and lets
// interactive requests in between, so a larger claim only spreads the claim,
// memory lookup and bookkeeping round trips over more jobs.
const BATCH = 24;

/** Contexts of the keyed catalogue (the module names in src/lib/i18n/messages). */
const KEYED_CONTEXTS = new Set(allMessages().map((message) => message.context));
function canQueueText(
  namespace: string,
  source: string,
  text: string,
  catalogue: ReadonlySet<string>,
): boolean {
  return (
    !PRIVATE_NAMESPACES.has(namespace) &&
    (namespace !== "ui" || (source === SOURCE_LANGUAGE && catalogue.has(text.trim())))
  );
}

export type EnqueueItem = {
  text: string;
  source?: string;
  target: string;
  namespace?: string;
  context?: string | null;
  refresh?: boolean;
  priority?: number;
};

/** Languages whose text is produced by translation (not the source or its regional varieties). */
export function translatableLanguages(): LanguageDefinition[] {
  const source = getLanguage(SOURCE_LANGUAGE)!;
  return SUPPORTED_LANGUAGES.filter(
    (l) => !(l.iso639_3 === source.iso639_3 && l.script === source.script),
  );
}

export async function enqueueJobs(
  items: EnqueueItem[],
  requestedBy: string | null,
): Promise<number> {
  const client = await db();
  const disabled = await disabledLanguages(client);
  const catalogue = items.some(
    (item) => (item.namespace ?? "ui") === "ui" && !STATIC_CATALOGUE.has(item.text.trim()),
  )
    ? await publicCatalogue(client)
    : STATIC_CATALOGUE;
  let inserted = 0;
  const rows = [];
  // The same text goes to many languages: each distinct text and context is
  // hashed once. Hashing runs on libuv's thread pool, which DNS lookups share;
  // tens of thousands of hashes queued there (the catalogue for 132
  // languages) held up every outgoing request of the site until they were done.
  const sourceHashes = new Map<string, string>();
  const contextHashes = new Map<string, string>();
  for (const item of items) {
    const text = item.text.trim();
    const source = getLanguage(item.source ?? SOURCE_LANGUAGE);
    const target = getLanguage(item.target);
    if (
      !text ||
      !source?.enabled ||
      !target?.enabled ||
      disabled.has(source.code) ||
      disabled.has(target.code)
    )
      continue;
    const namespace = item.namespace ?? "ui";
    if (!NAMESPACE_PATTERN.test(namespace)) throw new Error("Invalid namespace.");
    if (!canQueueText(namespace, source.code, text, catalogue))
      throw new Error(
        "Private or non-catalogue page text cannot be persisted in the translation job queue.",
      );
    const contextKey = JSON.stringify([namespace, item.context ?? null]);
    let textHash = sourceHashes.get(text);
    if (textHash === undefined) sourceHashes.set(text, (textHash = await sourceHash(text)));
    let ctxHash = contextHashes.get(contextKey);
    if (ctxHash === undefined)
      contextHashes.set(contextKey, (ctxHash = await contextHash(namespace, item.context ?? null)));
    rows.push({
      source_hash: textHash,
      source_text: text,
      source_language: source.code,
      target_language: target.code,
      namespace,
      context: item.context ?? null,
      context_hash: ctxHash,
      refresh: Boolean(item.refresh),
      priority: item.priority ?? 100,
      requested_by: requestedBy,
    });
  }
  for (let i = 0; i < rows.length; i += 2000) {
    const [row] = await client<{ queued: number }[]>`
      select public.i18n_enqueue_translation_jobs(
        ${JSON.stringify(rows.slice(i, i + 2000))}::jsonb
      ) as queued`;
    if (!row) throw new Error("The database did not return an enqueue result.");
    inserted += Number(row.queued);
  }
  return inserted;
}

/**
 * Queue the keyed messages (src/lib/i18n/messages) for every language, each in
 * its module's context. The database skips what memory already holds and what
 * is already queued, so this is cheap to repeat: the worker runs it at start,
 * which is how a key added in a deploy is translated before anyone asks for
 * it. A key whose English changed has a new source hash and is translated
 * again; the old translation is no longer looked up.
 */
export async function syncMessageCatalogue(options: { requestedBy?: string | null } = {}): Promise<{
  languages: number;
  messages: number;
  queued: number;
  stale: number;
  upgrades: number;
}> {
  const client = await db();
  const disabled = await disabledLanguages(client);
  const languages = translatableLanguages().filter((l) => l.enabled && !disabled.has(l.code));
  const messages = allMessages();
  const items: EnqueueItem[] = [];
  for (const language of languages) {
    for (const message of messages) {
      items.push({
        text: message.text,
        target: language.code,
        namespace: "ui",
        context: message.context,
        // Ahead of the page-text backlog: these are the screens customers use.
        priority: 40,
      });
    }
  }
  const queued = await enqueueJobs(items, options.requestedBy ?? null);
  count("jobs.catalogue_sync_queued", queued);

  // Translations of English a module no longer has are marked stale.
  let stale = 0;
  {
    const byContext = new Map<string, string[]>();
    for (const message of messages) {
      const hashes = byContext.get(message.context) ?? [];
      hashes.push(await sourceHash(message.text));
      byContext.set(message.context, hashes);
    }
    for (const [context, hashes] of byContext) {
      const [row] = await client<{ stale: number }[]>`
        select public.i18n_mark_stale('ui', ${context}, ${client.array(hashes)}::text[]) as stale`;
      if (!row) throw new Error("The database did not return a stale-marking result.");
      stale += Number(row.stale);
    }
  }
  // Keyed translations still in fast realtime quality (made on demand for a
  // visitor, or before the mode was recorded) whose job has already run are
  // queued again, to be replaced by the quality-mode translation.
  let upgrades = 0;
  {
    const contexts = [...KEYED_CONTEXTS];
    type UpgradeRow = {
      source_text: string;
      source_language: string;
      target_language: string;
      context: string;
    };
    const rows: UpgradeRow[] = [];
    for (let from = 0; ; from += 1000) {
      const data = await client<UpgradeRow[]>`
        select source_text, source_language, target_language, context
        from public.marketplace_translations
        where namespace = 'ui' and context = any(${client.array(contexts)}::text[])
          and source_language = ${SOURCE_LANGUAGE} and status = 'machine'
          and (metadata->>'mode' is null or metadata->>'mode' not in ('quality', ${QUALITY_ATTEMPTED_MODE}))
        order by id limit 1000 offset ${from}`;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    upgrades = await enqueueJobs(
      rows.map((row) => ({
        text: row.source_text,
        source: row.source_language,
        target: row.target_language,
        namespace: "ui",
        context: row.context,
        refresh: true,
        priority: 45,
      })),
      options.requestedBy ?? null,
    );
  }
  return { languages: languages.length, messages: messages.length, queued, stale, upgrades };
}

/** Queue the whole interface catalogue for the given languages. */
export async function enqueueCatalogue(
  targets: string[] | "all",
  options: { refresh?: boolean; requestedBy?: string | null } = {},
): Promise<{ languages: number; strings: number; queued: number }> {
  const disabled = await disabledLanguages(await db());
  const languages = (targets === "all" ? translatableLanguages().map((l) => l.code) : targets)
    .map((code) => getLanguage(code))
    .filter((l): l is LanguageDefinition => Boolean(l?.enabled) && !disabled.has(l!.code))
    .filter((l) => translatableLanguages().includes(l));
  const strings = [...(await publicCatalogue(await db()))];
  const items: EnqueueItem[] = [];
  for (const language of languages) {
    for (const text of strings) {
      // Reviewed dictionary text never needs a machine translation.
      if (UI_DICTIONARY[language.code]?.[text]) continue;
      items.push({
        text,
        target: language.code,
        namespace: "ui",
        refresh: options.refresh,
        priority: 50,
      });
    }
  }
  const queued = await enqueueJobs(items, options.requestedBy ?? null);
  return { languages: languages.length, strings: strings.length, queued };
}

type JobRow = {
  id: string;
  source_text: string;
  source_language: string;
  target_language: string;
  namespace: string;
  context: string | null;
  refresh: boolean;
};

export type RunSummary = {
  claimed: number;
  done: number;
  retried: number;
  skipped: boolean;
  reason?: string;
};

/** True when the database does not have the job queue yet (migration not applied). */
function schemaMissing(message: string): boolean {
  return /does not exist|42P01|42883/i.test(message);
}

let running = false;

/** Claim and translate one batch. */
export async function runJobBatch(limit = BATCH): Promise<RunSummary> {
  if (running)
    return { claimed: 0, done: 0, retried: 0, skipped: true, reason: "a batch is already running" };
  running = true;
  try {
    const client = await db();
    const engine = getTranslationEngine();
    if (!engine.isAvailable())
      return { claimed: 0, done: 0, retried: 0, skipped: true, reason: "no engine" };
    // Configured is not the same as reachable. Claiming jobs while the engine is
    // down spends one of their attempts each, and three spent attempts fail a
    // job for good; so nothing is claimed until the engine answers /ready.
    if (!(await engineReachable())) {
      count("jobs.paused_engine_unreachable");
      return { claimed: 0, done: 0, retried: 0, skipped: true, reason: "engine not reachable" };
    }

    let jobs: JobRow[];
    try {
      jobs = await client<JobRow[]>`
        select * from public.i18n_claim_translation_jobs(${WORKER_ID}, ${limit}::int, 900::int)`;
    } catch (error) {
      if (schemaMissing(error instanceof Error ? error.message : String(error))) {
        return {
          claimed: 0,
          done: 0,
          retried: 0,
          skipped: true,
          reason: "the translation job schema is not applied on this database",
        };
      }
      throw error;
    }
    if (jobs.length === 0) return { claimed: 0, done: 0, retried: 0, skipped: false };

    const disabled = await disabledLanguages(client);
    const memory = createPostgresMemoryStore(client);
    const glossary = createPostgresGlossaryStore(client);
    const catalogue = jobs.some(
      (job) => job.namespace === "ui" && !STATIC_CATALOGUE.has(job.source_text.trim()),
    )
      ? await publicCatalogue(client)
      : STATIC_CATALOGUE;

    // Jobs that share a language pair and context go to the engine together.
    const groups = new Map<string, JobRow[]>();
    for (const job of jobs) {
      const key = JSON.stringify([
        job.source_language,
        job.target_language,
        job.namespace,
        job.context,
        job.refresh,
      ]);
      groups.set(key, [...(groups.get(key) ?? []), job]);
    }

    let done = 0;
    let retried = 0;
    for (const group of groups.values()) {
      const first = group[0]!;
      const finish = async (
        job: JobRow,
        ok: boolean,
        status: string | null,
        quality: number | null,
        err: string | null,
      ) => {
        await client.begin(async (transaction) => {
          const leased = await transaction<{ id: string }[]>`
            select id from public.i18n_translation_jobs
            where id = ${job.id}::uuid and locked_by = ${WORKER_ID} and status = 'running'
            for update`;
          if (!leased.length) throw new Error(`Translation job lease lost: ${job.id}`);
          await transaction`
            select public.i18n_finish_translation_job(
              ${job.id}::uuid, ${WORKER_ID}, ${ok}::boolean,
              ${status}::text, ${quality}::numeric, ${err}::text
            )`;
        });
        if (ok) done++;
        else retried++;
      };
      let result: Awaited<ReturnType<typeof runTranslationPipeline>>;
      try {
        if (
          group.some(
            (job) => !canQueueText(job.namespace, job.source_language, job.source_text, catalogue),
          )
        )
          throw new Error(
            "Private or non-catalogue page text cannot be processed from the persistent job queue.",
          );
        result = await runTranslationPipeline(
          {
            texts: group.map((j) => j.source_text),
            source: first.source_language,
            target: first.target_language,
            namespace: first.namespace,
            context: first.context,
            persist: true,
            mode: "quality",
            mayPersist: first.namespace === "ui" ? (text) => catalogue.has(text.trim()) : undefined,
            // Keyed messages are always translated in quality mode here, even
            // if a visitor's page already got a fast (realtime) translation
            // into memory; the new one replaces it only if it passes the
            // quality gate, and a reviewed translation is never touched.
            refresh: first.refresh || KEYED_CONTEXTS.has(first.context ?? ""),
          },
          {
            engine,
            memory,
            glossary,
            isLanguageEnabled: (code) => !disabled.has(code),
            log,
          },
        );
      } catch (err) {
        const message =
          err instanceof PipelineError ? `${err.reason}: ${err.message}` : String(err);
        await Promise.all(group.map((job) => finish(job, false, null, null, message)));
        continue;
      }
      const byText = new Map(result.outcomes.map((o) => [o.text, o]));
      // Outcomes are recorded together: each is its own round trip to the
      // database, and one after another they cost more than the translation.
      await Promise.all(
        group.map((job) => {
          const outcome = byText.get(job.source_text.trim());
          if (!outcome || outcome.status === "pending") {
            return finish(job, false, "pending", null, result.pendingReason ?? "not translated");
          }
          return finish(
            job,
            true,
            outcome.status,
            outcome.qualityScore,
            outcome.issues.join(",") || null,
          );
        }),
      );
    }
    return { claimed: jobs.length, done, retried, skipped: false };
  } finally {
    running = false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Poll interval while the queue is empty. */
const IDLE_POLL_MS = 30_000;
/** Pause after finding the host busy. */
const BUSY_PAUSE_MS = 60_000;
/** Gap between batches while there is work. */
const BUSY_QUEUE_GAP_MS = 1_000;

/**
 * Background translation shares the host with the site, and the engine is
 * CPU-bound. The worker yields when the one-minute load average is above this
 * (default: 120 % of the host's CPUs; service-owned configuration can override), so a
 * traffic spike gets the CPU and pre-translation continues afterwards.
 *
 * The engine's own work counts towards the load average: busy, it alone holds
 * it at about 1.5-2 on a 2-CPU host. A threshold below that (it was 80 %)
 * made the worker pause itself 71 times in 5 minutes with no site traffic at
 * all. Above the CPU count, it trips only when something else - the site -
 * wants the CPU as well.
 */
function hostBusyThreshold(): number {
  const configured = translationWorkerConfig().maxLoad;
  if (configured !== null && Number.isFinite(configured) && configured > 0) return configured;
  return Math.max(1, cpus().length * 1.2);
}

const PRUNE_EVERY_MS = 60 * 60_000;
let lastPrune = 0;

/** Hourly: delete finished jobs and old quota windows (public.i18n_prune). */
async function pruneIfDue() {
  if (Date.now() - lastPrune < PRUNE_EVERY_MS) return;
  const client = await db();
  const [row] = await client<{ jobs_deleted: number; quota_windows_deleted: number }[]>`
    select * from public.i18n_prune()`;
  lastPrune = Date.now();
  count("jobs.pruned", Number(row?.jobs_deleted ?? 0));
  count("quota.windows_pruned", Number(row?.quota_windows_deleted ?? 0));
}

const REQUEUE_EVERY_MS = 60 * 60_000;
let lastRequeue = 0;

/**
 * Hourly: jobs that failed only because the engine was unavailable go back in
 * the queue (public.i18n_requeue_engine_failures). They did nothing wrong, and
 * nothing else would ever retry them before the prune deletes them.
 */
async function requeueEngineFailuresIfDue() {
  if (Date.now() - lastRequeue < REQUEUE_EVERY_MS) return;
  const client = await db();
  const [row] = await client<{ requeued: number }[]>`
    select public.i18n_requeue_engine_failures() as requeued`;
  if (!row) throw new Error("The database did not return a requeue result.");
  lastRequeue = Date.now();
  count("jobs.requeued_engine_failures", Number(row.requeued));
}

let synced = false;
/** Seconds after start before the message catalogue is synced. */
const SYNC_AFTER_SECONDS = 120;

async function workerTick() {
  let delay = IDLE_POLL_MS;
  try {
    // Once per start, after the site has settled: the sync queues tens of
    // thousands of rows. Retried on the next tick if the database is not
    // reachable yet.
    if (!synced && process.uptime() > SYNC_AFTER_SECONDS) {
      try {
        log("[i18n] message catalogue synced", await syncMessageCatalogue());
        synced = true;
      } catch (err) {
        log("[i18n] message catalogue sync failed", err);
      }
    }
    await pruneIfDue();
    await requeueEngineFailuresIfDue();
    const [oneMinute = 0] = loadavg();
    if (oneMinute > hostBusyThreshold()) {
      count("jobs.paused_host_busy");
      delay = BUSY_PAUSE_MS;
    } else {
      const outcome = await runJobBatch();
      if (outcome.claimed > 0) delay = BUSY_QUEUE_GAP_MS;
    }
  } catch (err) {
    log("[i18n] job batch failed", err);
  }
  timer = setTimeout(() => void workerTick(), delay);
  // On Node the handle can be unreferenced so it never holds the process open.
  (timer as unknown as { unref?: () => void }).unref?.();
}

/**
 * Start the in-process worker once, unless service-owned configuration disables it.
 * It works the queue batch after batch while there is work and the host has
 * CPU to spare, and checks for new work every 30 seconds otherwise.
 */
export function ensureJobWorker() {
  if (timer || !translationWorkerConfig().enabled || typeof setTimeout !== "function") return;
  timer = setTimeout(() => void workerTick(), BUSY_QUEUE_GAP_MS);
  (timer as unknown as { unref?: () => void }).unref?.();
}
