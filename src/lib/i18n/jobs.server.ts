import { contextHash, sourceHash } from "./hash";
import { PipelineError, runTranslationPipeline } from "./pipeline";
import {
  SOURCE_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguage,
  type LanguageDefinition,
} from "./registry";
import {
  createSupabaseGlossaryStore,
  createSupabaseMemoryStore,
  db,
  disabledLanguages,
  getTranslationEngine,
  log,
} from "./service.server";
import { UI_DICTIONARY } from "./ui-dictionary";

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
const BATCH = 8;
const INTERVAL_MS = 30_000;

export type EnqueueItem = {
  text: string;
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
  const client = db();
  if (!client) throw new Error("The database is not configured.");
  let inserted = 0;
  const rows = [];
  for (const item of items) {
    const text = item.text.trim();
    const target = getLanguage(item.target);
    if (!text || !target?.enabled) continue;
    const namespace = item.namespace ?? "ui";
    rows.push({
      source_hash: await sourceHash(text),
      source_text: text,
      source_language: SOURCE_LANGUAGE,
      target_language: target.code,
      namespace,
      context: item.context ?? null,
      context_hash: await contextHash(namespace, item.context ?? null),
      refresh: Boolean(item.refresh),
      priority: item.priority ?? 100,
      requested_by: requestedBy,
    });
  }
  for (let i = 0; i < rows.length; i += 2000) {
    const { data, error } = await client.rpc("i18n_enqueue_translation_jobs", {
      p_jobs: rows.slice(i, i + 2000),
    });
    if (error) throw new Error(error.message);
    inserted += Number(data ?? 0);
  }
  return inserted;
}

/** Queue the whole interface catalogue for the given languages. */
export async function enqueueCatalogue(
  targets: string[] | "all",
  options: { refresh?: boolean; requestedBy?: string | null } = {},
): Promise<{ languages: number; strings: number; queued: number }> {
  const disabled = await disabledLanguages(db());
  const languages = (targets === "all" ? translatableLanguages().map((l) => l.code) : targets)
    .map((code) => getLanguage(code))
    .filter((l): l is LanguageDefinition => Boolean(l?.enabled) && !disabled.has(l!.code))
    .filter((l) => translatableLanguages().includes(l));
  const strings = Object.keys(UI_DICTIONARY[SOURCE_LANGUAGE] ?? {});
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
  return /schema cache|does not exist|PGRST202|42P01|42883/i.test(message);
}

let running = false;

/** Claim and translate one batch. */
export async function runJobBatch(limit = BATCH): Promise<RunSummary> {
  const client = db();
  if (!client) return { claimed: 0, done: 0, retried: 0, skipped: true, reason: "no database" };
  if (running)
    return { claimed: 0, done: 0, retried: 0, skipped: true, reason: "a batch is already running" };
  const engine = getTranslationEngine();
  if (!engine.isAvailable())
    return { claimed: 0, done: 0, retried: 0, skipped: true, reason: "no engine" };

  running = true;
  try {
    const { data, error } = await client.rpc("i18n_claim_translation_jobs", {
      p_worker: WORKER_ID,
      p_limit: limit,
      p_lease_seconds: 900,
    });
    if (error) {
      if (schemaMissing(error.message)) {
        return {
          claimed: 0,
          done: 0,
          retried: 0,
          skipped: true,
          reason: "the translation job schema is not applied on this database",
        };
      }
      throw new Error(error.message);
    }
    const jobs = (data ?? []) as JobRow[];
    if (jobs.length === 0) return { claimed: 0, done: 0, retried: 0, skipped: false };

    const disabled = await disabledLanguages(client);
    const memory = createSupabaseMemoryStore(client);
    const glossary = createSupabaseGlossaryStore(client);

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
        const { error: finishError } = await client.rpc("i18n_finish_translation_job", {
          p_id: job.id,
          p_worker: WORKER_ID,
          p_ok: ok,
          p_result_status: status,
          p_quality: quality,
          p_error: err,
        });
        if (finishError) log("[i18n] could not record job outcome", finishError.message);
        if (ok) done++;
        else retried++;
      };
      try {
        const result = await runTranslationPipeline(
          {
            texts: group.map((j) => j.source_text),
            source: first.source_language,
            target: first.target_language,
            namespace: first.namespace,
            context: first.context,
            persist: true,
            mode: "quality",
            refresh: first.refresh,
          },
          {
            engine,
            memory,
            glossary,
            isLanguageEnabled: (code) => !disabled.has(code),
            log,
          },
        );
        const byText = new Map(result.outcomes.map((o) => [o.text, o]));
        for (const job of group) {
          const outcome = byText.get(job.source_text.trim());
          if (!outcome || outcome.status === "pending") {
            await finish(job, false, "pending", null, result.pendingReason ?? "not translated");
          } else {
            await finish(
              job,
              true,
              outcome.status,
              outcome.qualityScore,
              outcome.issues.join(",") || null,
            );
          }
        }
      } catch (err) {
        const message =
          err instanceof PipelineError ? `${err.reason}: ${err.message}` : String(err);
        for (const job of group) await finish(job, false, null, null, message);
      }
    }
    return { claimed: jobs.length, done, retried, skipped: false };
  } finally {
    running = false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the in-process worker once. Off when I18N_JOB_WORKER=off, so an
 * instance can be excluded (e.g. a second replica that should only serve).
 */
export function ensureJobWorker() {
  if (timer || process.env.I18N_JOB_WORKER === "off" || typeof setInterval !== "function") return;
  timer = setInterval(() => {
    runJobBatch().catch((err) => log("[i18n] job batch failed", err));
  }, INTERVAL_MS);
  // On Node the handle can be unreferenced so it never holds the process open.
  (timer as unknown as { unref?: () => void }).unref?.();
}
